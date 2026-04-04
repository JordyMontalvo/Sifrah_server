#!/usr/bin/env node
/**
 * Reporte por usuario: bono residual (simulación motor), logro/mantenimiento por rango (simulación),
 * y pagos ya registrados en Mongo (rank_bonus_payments + transacciones virtuales "residual").
 *
 * Uso (desde server):
 *   node scripts/report-users-bonuses.js
 *   node scripts/report-users-bonuses.js --json   # además escribe .json
 *
 * Salida: server/reports/ (visible en el IDE; server/logs está en .gitignore)
 */

const path = require("path")
const fs = require("fs")
const { execFileSync } = require("child_process")

const dotenv = require("dotenv")
const { MongoClient } = require("mongodb")

const {
  maxClosedRankIndexFromHistory,
  buildPaymentStateFromDocs,
  evaluateRankBonusesForUser,
} = require("../lib/rankBonusEngine")
dotenv.config({ path: path.resolve(__dirname, "../../db/.env") })
dotenv.config({ path: path.resolve(__dirname, "../.env.local") })
dotenv.config({ path: path.resolve(__dirname, "../.env") })

function mongoUriAndName() {
  const uri =
    process.env.DB_URL ||
    process.env.MONGODB_URI ||
    process.env.DB_URL_DEV ||
    process.env.DB_URL_PROD
  const dbName =
    process.env.DB_NAME ||
    process.env.DB_NAME_DEV ||
    process.env.DB_NAME_PROD ||
    "sifrah"
  return { uri, dbName }
}

function runGoPreviewJson() {
  const engineDir = path.resolve(__dirname, "../cierre_engine")
  const env = { ...process.env }
  try {
    const out = execFileSync("go", ["run", ".", "--dry-run", "--json"], {
      cwd: engineDir,
      env,
      maxBuffer: 64 * 1024 * 1024,
      encoding: "utf8",
    })
    return JSON.parse(out)
  } catch (e) {
    const engineLinux = path.join(engineDir, "engine_linux")
    if (fs.existsSync(engineLinux)) {
      const out = execFileSync(engineLinux, ["--dry-run", "--json"], {
        cwd: engineDir,
        env,
        maxBuffer: 64 * 1024 * 1024,
        encoding: "utf8",
      })
      return JSON.parse(out)
    }
    throw e
  }
}

function csvEscape(s) {
  const x = String(s ?? "")
  if (/[",\n\r]/.test(x)) return `"${x.replace(/"/g, '""')}"`
  return x
}

function aggregateRankPayments(docs) {
  const byUser = new Map()
  for (const p of docs || []) {
    const uid = p.user_id || p.userId
    if (!uid) continue
    if (!byUser.has(uid)) {
      byUser.set(uid, { logro: 0, mantenimiento: 0, detalle: [] })
    }
    const row = byUser.get(uid)
    const tipo = p.tipo || p.type || ""
    const amt = Number(p.amount || 0)
    const r = p.rank || ""
    row.detalle.push({ tipo, rank: r, amount: amt, period_key: p.period_key || "", date: p.created_at || p.date })
    if (tipo === "logro") row.logro += amt
    else if (tipo === "mantenimiento") row.mantenimiento += amt
  }
  return byUser
}

async function aggregateResidualTx(db) {
  const byUser = new Map()
  try {
    const cursor = db.collection("transactions").aggregate([
      {
        $match: {
          virtual: true,
          type: "in",
          name: { $regex: /residual/i },
        },
      },
      {
        $group: {
          _id: "$user_id",
          total: { $sum: "$value" },
          count: { $sum: 1 },
        },
      },
    ])
    const arr = await cursor.toArray()
    for (const x of arr) {
      if (x._id) byUser.set(x._id, { total: Number(x.total || 0), count: x.count || 0 })
    }
  } catch (e) {
    /* ignore */
  }
  return byUser
}

async function main() {
  const wantJson = process.argv.includes("--json")
  const { uri, dbName } = mongoUriAndName()
  if (!uri) {
    console.error("Falta DB_URL / DB_URL_DEV en entorno")
    process.exit(1)
  }

  const lines = []
  const log = (msg) => {
    lines.push(msg)
    console.log(msg)
  }

  log("=== Reporte por usuario: residual, logro rango, mantenimiento y pagos en DB ===")
  log(`Base: ${dbName}  |  ${new Date().toISOString()}`)
  log("")
  log("Leyenda:")
  log("  *_sim = simulación próximo cierre (motor Go dry-run + motor bonos rango)")
  log("  *_db  = histórico acumulado en Mongo (transacciones virtuales ingreso 'residual*'; rank_bonus_payments)")
  log("")

  const preview = runGoPreviewJson()
  const tree = preview.tree || []

  const client = await MongoClient.connect(uri, { useUnifiedTopology: true })
  const db = client.db(dbName)

  const [usersArr, closeds, paymentDocs, residualByUser] = await Promise.all([
    db
      .collection("users")
      .find({}, { projection: { id: 1, name: 1, lastName: 1, dni: 1 } })
      .toArray(),
    db.collection("closeds").find({}).toArray(),
    db.collection("rank_bonus_payments").find({}).toArray().catch(() => []),
    aggregateResidualTx(db),
  ])

  const userMeta = new Map()
  for (const u of usersArr) {
    const id = u.id
    if (!id) continue
    const nombre = [u.name, u.lastName].filter(Boolean).join(" ").trim() || "—"
    userMeta.set(id, { nombre, dni: u.dni != null ? String(u.dni) : "—" })
  }

  const maxByUser = maxClosedRankIndexFromHistory(closeds)
  const payState = buildPaymentStateFromDocs(paymentDocs)
  const rankPaidByUser = aggregateRankPayments(paymentDocs)

  const rows = []

  for (const node of tree) {
    const uid = node.id
    const rank = node.rank || "none"
    const pts = Number(node._total != null ? node._total : node.total || 0)
    const residualSim = Number(node.residual_bonus || 0)
    const maxEverIdx = maxByUser.has(uid) ? maxByUser.get(uid) : -1

    const { lines: bonusLines } = evaluateRankBonusesForUser({
      userId: uid,
      closedRank: rank,
      maxEverIdx,
      paymentState: payState,
    })

    let logroSim = 0
    let mantSim = 0
    const detalleLogro = []
    const detalleMant = []
    for (const b of bonusLines) {
      if (b.tipo === "logro") {
        logroSim += b.amount
        detalleLogro.push(`${b.rank} $${b.amount}`)
      } else if (b.tipo === "mantenimiento") {
        mantSim += b.amount
        detalleMant.push(`${b.rank} $${b.amount}`)
      }
    }

    const paidRank = rankPaidByUser.get(uid) || { logro: 0, mantenimiento: 0, detalle: [] }
    const paidRes = residualByUser.get(uid) || { total: 0, count: 0 }

    const meta = userMeta.get(uid) || {}
    const nombre = meta.nombre || (node.name || "—").trim()
    const dni = meta.dni || "—"

    const tieneAlgo =
      residualSim > 0 ||
      logroSim > 0 ||
      mantSim > 0 ||
      paidRank.logro > 0 ||
      paidRank.mantenimiento > 0 ||
      paidRes.total > 0

    if (!tieneAlgo) continue

    rows.push({
      usuario_id: uid,
      nombre,
      dni,
      rango_sim: rank,
      puntos_red: pts,
      bono_residual_sim: residualSim,
      bono_logro_rango_sim: logroSim,
      detalle_logro_sim: detalleLogro.join("; ") || "—",
      bono_mantenimiento_sim: mantSim,
      detalle_mantenimiento_sim: detalleMant.join("; ") || "—",
      total_rank_sim: logroSim + mantSim,
      total_cierre_sim: residualSim + logroSim + mantSim,
      pagado_logro_rango_db: paidRank.logro,
      pagado_mantenimiento_rango_db: paidRank.mantenimiento,
      pagado_residual_db: paidRes.total,
      tx_residual_count_db: paidRes.count,
    })
  }

  // Usuarios con pagos en DB que no salieron en el árbol del preview
  const treeIds = new Set(tree.map((n) => n.id))
  for (const uid of rankPaidByUser.keys()) {
    if (treeIds.has(uid)) continue
    const paidRank = rankPaidByUser.get(uid)
    const paidRes = residualByUser.get(uid) || { total: 0, count: 0 }
    if (!paidRank || (paidRank.logro === 0 && paidRank.mantenimiento === 0)) continue
    const meta = userMeta.get(uid) || {}
    rows.push({
      usuario_id: uid,
      nombre: meta.nombre || "—",
      dni: meta.dni || "—",
      rango_sim: "—",
      puntos_red: 0,
      bono_residual_sim: 0,
      bono_logro_rango_sim: 0,
      detalle_logro_sim: "—",
      bono_mantenimiento_sim: 0,
      detalle_mantenimiento_sim: "—",
      total_rank_sim: 0,
      total_cierre_sim: 0,
      pagado_logro_rango_db: paidRank.logro,
      pagado_mantenimiento_rango_db: paidRank.mantenimiento,
      pagado_residual_db: paidRes.total,
      tx_residual_count_db: paidRes.count,
      nota: "solo pagos DB (no en preview árbol)",
    })
  }

  for (const uid of residualByUser.keys()) {
    if (treeIds.has(uid)) continue
    if (rankPaidByUser.has(uid)) continue
    const paidRes = residualByUser.get(uid)
    if (!paidRes || paidRes.total <= 0) continue
    const meta = userMeta.get(uid) || {}
    rows.push({
      usuario_id: uid,
      nombre: meta.nombre || "—",
      dni: meta.dni || "—",
      rango_sim: "—",
      puntos_red: 0,
      bono_residual_sim: 0,
      bono_logro_rango_sim: 0,
      detalle_logro_sim: "—",
      bono_mantenimiento_sim: 0,
      detalle_mantenimiento_sim: "—",
      total_rank_sim: 0,
      total_cierre_sim: 0,
      pagado_logro_rango_db: 0,
      pagado_mantenimiento_rango_db: 0,
      pagado_residual_db: paidRes.total,
      tx_residual_count_db: paidRes.count,
      nota: "solo residual DB (no en preview)",
    })
  }

  rows.sort((a, b) => b.total_cierre_sim - a.total_cierre_sim || b.pagado_residual_db - a.pagado_residual_db)

  const conLogroSim = rows.filter((r) => r.bono_logro_rango_sim > 0)
  const conMantSim = rows.filter((r) => r.bono_mantenimiento_sim > 0)
  const conResidualSim = rows.filter((r) => r.bono_residual_sim > 0)
  const conPagoDb = rows.filter(
    (r) =>
      r.pagado_logro_rango_db > 0 ||
      r.pagado_mantenimiento_rango_db > 0 ||
      r.pagado_residual_db > 0
  )

  log(`Usuarios con algún bono (sim o DB): ${rows.length}`)
  log(`  · con bono logro rango (sim):     ${conLogroSim.length}`)
  log(`  · con bono mantenimiento (sim):   ${conMantSim.length}`)
  log(`  · con bono residual (sim):        ${conResidualSim.length}`)
  log(`  · con pagos registrados en DB:    ${conPagoDb.length}`)
  log("")

  const headers = [
    "usuario_id",
    "nombre",
    "dni",
    "rango_sim",
    "puntos_red",
    "bono_residual_sim",
    "bono_logro_rango_sim",
    "detalle_logro_sim",
    "bono_mantenimiento_sim",
    "detalle_mant_sim",
    "total_rank_sim",
    "total_cierre_sim",
    "pagado_logro_db",
    "pagado_mant_db",
    "pagado_residual_db",
    "tx_residual_cnt",
  ]

  log(headers.join("\t"))
  for (const r of rows) {
    log(
      [
        r.usuario_id,
        r.nombre,
        r.dni,
        r.rango_sim,
        r.puntos_red.toFixed(2),
        r.bono_residual_sim.toFixed(2),
        r.bono_logro_rango_sim.toFixed(2),
        r.detalle_logro_sim,
        r.bono_mantenimiento_sim.toFixed(2),
        r.detalle_mantenimiento_sim,
        r.total_rank_sim.toFixed(2),
        r.total_cierre_sim.toFixed(2),
        r.pagado_logro_rango_db.toFixed(2),
        r.pagado_mantenimiento_rango_db.toFixed(2),
        r.pagado_residual_db.toFixed(2),
        String(r.tx_residual_count_db),
      ].join("\t")
    )
    if (r.nota) log(`  → ${r.nota}`)
  }

  log("")
  const sum = (f) => rows.reduce((a, r) => a + f(r), 0)
  log("--- Totales (filas anteriores) ---")
  log(`  Suma bono_residual_sim:           $${sum((r) => r.bono_residual_sim).toFixed(2)}`)
  log(`  Suma bono_logro_rango_sim:        $${sum((r) => r.bono_logro_rango_sim).toFixed(2)}`)
  log(`  Suma bono_mantenimiento_sim:      $${sum((r) => r.bono_mantenimiento_sim).toFixed(2)}`)
  log(`  Suma total_cierre_sim:            $${sum((r) => r.total_cierre_sim).toFixed(2)}`)
  log(`  Suma pagado_logro_rango_db:       $${sum((r) => r.pagado_logro_rango_db).toFixed(2)}`)
  log(`  Suma pagado_mantenimiento_db:     $${sum((r) => r.pagado_mantenimiento_rango_db).toFixed(2)}`)
  log(`  Suma pagado_residual_db (hist.):  $${sum((r) => r.pagado_residual_db).toFixed(2)}`)

  await client.close()

  const outDir = path.resolve(__dirname, "../reports")
  fs.mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const base = path.join(outDir, `report_users_bonuses_${stamp}`)
  fs.writeFileSync(`${base}.txt`, lines.join("\n"), "utf8")

  const csvHeader = [
    "usuario_id",
    "nombre",
    "dni",
    "rango_sim",
    "puntos_red",
    "bono_residual_sim",
    "bono_logro_rango_sim",
    "detalle_logro_sim",
    "bono_mantenimiento_sim",
    "detalle_mantenimiento_sim",
    "total_rank_sim",
    "total_cierre_sim",
    "pagado_logro_rango_db",
    "pagado_mantenimiento_rango_db",
    "pagado_residual_db",
    "tx_residual_count_db",
    "nota",
  ]
  const csvLines = [csvHeader.join(",")]
  for (const r of rows) {
    csvLines.push(
      [
        csvEscape(r.usuario_id),
        csvEscape(r.nombre),
        csvEscape(r.dni),
        csvEscape(r.rango_sim),
        csvEscape(r.puntos_red.toFixed(2)),
        csvEscape(r.bono_residual_sim.toFixed(2)),
        csvEscape(r.bono_logro_rango_sim.toFixed(2)),
        csvEscape(r.detalle_logro_sim),
        csvEscape(r.bono_mantenimiento_sim.toFixed(2)),
        csvEscape(r.detalle_mantenimiento_sim),
        csvEscape(r.total_rank_sim.toFixed(2)),
        csvEscape(r.total_cierre_sim.toFixed(2)),
        csvEscape(r.pagado_logro_rango_db.toFixed(2)),
        csvEscape(r.pagado_mantenimiento_rango_db.toFixed(2)),
        csvEscape(r.pagado_residual_db.toFixed(2)),
        csvEscape(r.tx_residual_count_db),
        csvEscape(r.nota || ""),
      ].join(",")
    )
  }
  fs.writeFileSync(`${base}.csv`, csvLines.join("\n"), "utf8")

  if (wantJson) {
    fs.writeFileSync(`${base}.json`, JSON.stringify(rows, null, 2), "utf8")
  }

  log("")
  log(`Archivos: ${base}.txt  |  ${base}.csv${wantJson ? `  |  ${base}.json` : ""}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
