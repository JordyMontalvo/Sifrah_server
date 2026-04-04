#!/usr/bin/env node
/**
 * Dry-run del cierre: ejecuta el motor Go (--dry-run --json), suma residual,
 * evalúa bonos logro/mantenimiento por rango y escribe log detallado.
 *
 * Uso (desde carpeta server):
 *   node scripts/preview-closure-total.js
 *
 * Requiere: Go, variables DB como en cierre_engine (DB_URL_DEV / DB_NAME_DEV o PROD),
 * y opcionalmente registros en rank_bonus_payments.
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
const { RANK_BONUS_TABLE, normalizeRank, rankIndex } = require("../lib/rankBonusConfig")

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

function pad(s, n) {
  const x = String(s)
  return x.length >= n ? x : x + " ".repeat(n - x.length)
}

async function main() {
  const { uri, dbName } = mongoUriAndName()
  if (!uri) {
    console.error("Falta DB_URL / DB_URL_DEV / DB_URL_PROD en entorno")
    process.exit(1)
  }

  const lines = []
  const log = (msg) => {
    lines.push(msg)
    console.log(msg)
  }

  log("=== Preview cierre total (residual + bonos por rango) ===")
  log(`Mongo: ${dbName}`)
  log(`Fecha: ${new Date().toISOString()}`)
  log("")

  log("--- Tabla bonos por rango (referencia) ---")
  for (const [r, row] of Object.entries(RANK_BONUS_TABLE)) {
    if (row.cap === 0 && row.logro === 0) continue
    log(
      `  ${pad(r, 22)} cap=${pad(row.cap, 8)} logro=${pad(row.logro, 8)} mant=${row.maintenance}`
    )
  }
  log("")

  log("--- Ejecutando motor Go (dry-run JSON)... ---")
  const preview = runGoPreviewJson()
  const tree = preview.tree || []
  const virtualResets = preview.virtual_resets || []
  log(`Nodos en preview: ${tree.length}`)
  const totalVirt = virtualResets.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  log(`Saldo no disponible (virtual) a quitar: ${virtualResets.length} usuario(s) · total S/ ${totalVirt.toFixed(2)}`)
  if (virtualResets.length) {
    log("--- Usuarios con closed reset (saldo virtual > 0) ---")
    for (const r of virtualResets) {
      log(`  ${r.id} | ${r.name || "—"} | DNI ${r.dni || "—"} | S/ ${Number(r.amount || 0).toFixed(2)}`)
    }
  }
  log("")

  const client = await MongoClient.connect(uri, { useUnifiedTopology: true })
  const db = client.db(dbName)

  const closeds = await db.collection("closeds").find({}).toArray()
  const maxByUser = maxClosedRankIndexFromHistory(closeds)
  log(`Cierres históricos en DB: ${closeds.length}`)

  let paymentDocs = []
  try {
    paymentDocs = await db.collection("rank_bonus_payments").find({}).toArray()
  } catch (e) {
    log("(rank_bonus_payments: colección vacía o inexistente — se asume sin pagos previos)")
  }
  log(`Pagos rank_bonus_payments: ${paymentDocs.length}`)
  const payState = buildPaymentStateFromDocs(paymentDocs)
  log("")

  let totalResidual = 0
  let totalLogro = 0
  let totalMant = 0
  const byRankResidual = {}
  const byRankLogro = {}
  const byRankMant = {}

  const userDetails = []

  log("--- Por usuario (rango motor | pts | residual | bonos rango) ---")
  for (const node of tree) {
    const uid = node.id
    const name = node.name || ""
    const rank = node.rank || "none"
    const pts = Number(node._total != null ? node._total : node.total || 0)
    const res = Number(node.residual_bonus || 0)
    totalResidual += res

    const rNorm = normalizeRank(rank)
    if (rNorm) {
      byRankResidual[rNorm] = (byRankResidual[rNorm] || 0) + res
    }

    const maxEver = maxByUser.get(uid)
    const maxEverIdx = maxEver !== undefined ? maxEver : -1

    const { lines: bonusLines, logLines: bonusLogs } = evaluateRankBonusesForUser({
      userId: uid,
      closedRank: rank,
      maxEverIdx,
      paymentState: payState,
    })

    let uLogro = 0
    let uMant = 0
    for (const b of bonusLines) {
      if (b.tipo === "logro") {
        uLogro += b.amount
        byRankLogro[b.rank] = (byRankLogro[b.rank] || 0) + b.amount
      } else if (b.tipo === "mantenimiento") {
        uMant += b.amount
        byRankMant[b.rank] = (byRankMant[b.rank] || 0) + b.amount
      }
    }
    totalLogro += uLogro
    totalMant += uMant

    const bonusStr =
      bonusLines.length === 0
        ? "—"
        : bonusLines.map((b) => `${b.tipo} ${b.rank} $${b.amount}`).join("; ")

    if (res > 0 || bonusLines.length > 0 || (rNorm && rankIndex(rank) >= 2)) {
      log(`${pad(uid, 26)} | ${pad(rank, 20)} | pts=${pts.toFixed(2)} | res=$${res.toFixed(2)} | ${bonusStr}`)
      for (const bl of bonusLogs) log(bl)
    }

    userDetails.push({
      id: uid,
      name,
      rank,
      points: pts,
      residual_bonus: res,
      max_ever_rank_idx: maxEverIdx,
      rank_bonuses: bonusLines,
    })
  }

  log("")
  log("=== Resumen monetario (preview, sin persistir) ===")
  log(`Total residual (motor):     $${totalResidual.toFixed(2)}`)
  log(`Total bonos logro (propuesto): $${totalLogro.toFixed(2)}`)
  log(`Total bonos mantenimiento:     $${totalMant.toFixed(2)}`)
  log(
    `TOTAL general (residual+logro+mant): $${(totalResidual + totalLogro + totalMant).toFixed(2)}`
  )
  log("")

  log("--- Residual por rango cerrado ---")
  Object.keys(byRankResidual)
    .sort((a, b) => rankIndex(a) - rankIndex(b))
    .forEach((r) => log(`  ${r}: $${byRankResidual[r].toFixed(2)}`))

  log("")
  log("--- Bonos logro propuestos por rango ---")
  Object.keys(byRankLogro)
    .sort((a, b) => rankIndex(a) - rankIndex(b))
    .forEach((r) => log(`  ${r}: $${byRankLogro[r].toFixed(2)}`))

  log("")
  log("--- Bonos mantenimiento propuestos por rango ---")
  Object.keys(byRankMant)
    .sort((a, b) => rankIndex(a) - rankIndex(b))
    .forEach((r) => log(`  ${r}: $${byRankMant[r].toFixed(2)}`))

  await client.close()

  const outDir = path.resolve(__dirname, "../reports")
  try {
    fs.mkdirSync(outDir, { recursive: true })
  } catch (e) {
    /* ignore */
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outPath = path.join(outDir, `preview_closure_total_${stamp}.txt`)
  fs.writeFileSync(outPath, lines.join("\n"), "utf8")
  log("")
  log(`Log guardado en: ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
