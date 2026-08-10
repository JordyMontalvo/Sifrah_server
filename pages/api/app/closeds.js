import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Closed, Transaction, Period, Activation, Affiliation, Tree } = db
const { error, success, midd } = lib

const AFF_NAMES = new Set(["affiliation bonus", "migration bonus"])
const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

const RESIDUAL_TX = new Set(["residual bonus", "residual", "closed bonus"])
const GEN_TX = new Set(["generational bonus vip", "generational bonus"])
const SAVINGS_TX = new Set(["bono ahorro sifrah", "savings bonus"])
const RANK_LOGRO_TX = new Set(["bono logro rango"])
const RANK_MANT_TX = new Set(["bono mantenimiento rango"])

function entryUserId(u) {
  if (!u || typeof u !== "object") return null
  const id =
    u.user_id ??
    u.userId ??
    u.UserID ??
    u.id ??
    u._id ??
    null
  if (id == null || id === "") return null
  // ObjectId u similares
  if (typeof id === "object" && id.toString) return String(id.toString())
  return String(id)
}

function findUserEntry(closed, user) {
  if (!closed || !user) return null
  const uid = String(user.id)
  const dni = user.dni != null ? String(user.dni).trim() : ""

  const pools = []
  if (Array.isArray(closed.users)) pools.push(...closed.users)
  if (Array.isArray(closed.tree)) pools.push(...closed.tree)

  // Algunos documentos guardan en data.users
  if (closed.data && Array.isArray(closed.data.users)) {
    pools.push(...closed.data.users)
  }

  for (const u of pools) {
    const id = entryUserId(u)
    if (id && id === uid) return u
  }
  if (dni) {
    for (const u of pools) {
      if (u && u.dni != null && String(u.dni).trim() === dni) return u
    }
  }

  // Buscar en snapshots embebidos (raro pero útil)
  for (const u of pools) {
    const snap = u && (u.tree_snapshot || u.treeSnapshot)
    if (!snap) continue
    const hit = findInSnapshot(snap, uid, dni)
    if (hit) {
      // devolver el nodo del snapshot normalizado como entry mínima
      return {
        ...hit,
        user_id: hit.user_id || hit.id,
        residual_bonus: Number(hit.residual_bonus) || 0,
        generational_bonus: Number(hit.generational_bonus) || 0,
        savings_bonus: Number(hit.savings_bonus) || 0,
        residual_lines: hit.residual_lines || [],
        generational_lines: hit.generational_lines || [],
      }
    }
  }

  return null
}

function findInSnapshot(node, uid, dni) {
  if (!node) return null
  const id = entryUserId(node)
  if (id && id === uid) return node
  if (dni && node.dni != null && String(node.dni).trim() === dni) return node
  const kids = node.childs || node.children || []
  for (const ch of kids) {
    const hit = findInSnapshot(ch, uid, dni)
    if (hit) return hit
  }
  return null
}

function txMatchesPeriod(tx, periodKey, range) {
  if (!tx) return false
  if (periodKey && tx.period_key) {
    return String(tx.period_key) === String(periodKey)
  }
  if (!tx.date || !range || !range.start) return false
  const d = new Date(tx.date)
  if (Number.isNaN(d.getTime())) return false
  const end = range.end || d
  return d >= range.start && d <= end
}

/** Bono en sombra: no activo / no activado interno → no suma al total “real” */
function isVirtualTx(tx) {
  if (!tx) return false
  return (
    tx.virtual === true ||
    tx.virtual === 1 ||
    tx.virtual === "true" ||
    tx.virtual === "1"
  )
}

function isRealInTx(tx) {
  if (!tx || tx.type === "out") return false
  if (isVirtualTx(tx)) return false
  return true
}

/** Compra del socio aprobada/finalizada (activación o afiliación propia) */
function isPersonalPurchase(doc) {
  if (!doc) return false
  const s = String(doc.status || "").toLowerCase()
  if (!s) return true
  if (["pending", "rejected", "cancelled", "canceled", "anulado"].includes(s)) {
    return false
  }
  return true
}

function purchaseMatchesPeriod(doc, periodKey, range) {
  if (!doc) return false
  if (periodKey && doc.period_key) {
    return String(doc.period_key) === String(periodKey)
  }
  const raw = doc.approved_at || doc.date
  if (!raw || !range || !range.start) return false
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return false
  const end = range.end || d
  return d >= range.start && d <= end
}

function purchaseAmount(doc) {
  if (!doc) return 0
  if (doc.price != null && doc.price !== "") return Number(doc.price) || 0
  if (doc.plan && doc.plan.amount != null) return Number(doc.plan.amount) || 0
  if (Array.isArray(doc.products) && doc.products.length) {
    return doc.products.reduce((s, p) => {
      const unit = Number(p.price != null ? p.price : p.val) || 0
      const qty = Number(p.total) || 1
      return s + unit * qty
    }, 0)
  }
  return 0
}

function sumPersonalPurchases(activations, affiliations, periodKey, range) {
  let total = 0
  for (const a of activations || []) {
    if (!isPersonalPurchase(a)) continue
    if (!purchaseMatchesPeriod(a, periodKey, range)) continue
    total += purchaseAmount(a)
  }
  for (const a of affiliations || []) {
    if (!isPersonalPurchase(a)) continue
    if (!purchaseMatchesPeriod(a, periodKey, range)) continue
    total += purchaseAmount(a)
  }
  return Math.round(total * 100) / 100
}

function sumTxByNames(txs, names, periodKey, range) {
  return (txs || [])
    .filter((tx) => {
      if (!isRealInTx(tx)) return false
      const name = String(tx.name || "").toLowerCase()
      if (!names.has(name) && !names.has(tx.name)) return false
      return txMatchesPeriod(tx, periodKey, range)
    })
    .reduce((s, t) => s + (Number(t.value) || 0), 0)
}

function residualLinesFromTx(txs, periodKey, range) {
  return (txs || [])
    .filter((tx) => {
      if (!isRealInTx(tx)) return false
      const name = String(tx.name || "").toLowerCase()
      if (!RESIDUAL_TX.has(name)) return false
      return txMatchesPeriod(tx, periodKey, range)
    })
    .map((tx, i) => ({
      id: tx.id || `res-tx-${i}`,
      level: tx.level != null ? Number(tx.level) : 0,
      name: tx.affiliate_name || tx.desc || "Residual",
      dni: tx.affiliate_dni || null,
      pr: tx.pr != null ? Number(tx.pr) : null,
      percentage: tx.percentage != null ? Number(tx.percentage) : null,
      amount: Number(tx.value) || 0,
      date: tx.date || null,
    }))
}

function genLinesFromTx(txs, periodKey, range) {
  return (txs || [])
    .filter((tx) => {
      if (!isRealInTx(tx)) return false
      const name = String(tx.name || "").toLowerCase()
      if (!GEN_TX.has(name)) return false
      return txMatchesPeriod(tx, periodKey, range)
    })
    .map((tx, i) => ({
      id: tx.id || `gen-tx-${i}`,
      level: tx.level != null ? Number(tx.level) : 0,
      name: (tx.affiliate_name || "Gen. VIP") + " (Gen. VIP)",
      dni: tx.affiliate_dni || null,
      pr: tx.pr != null ? Number(tx.pr) : null,
      percentage: tx.percentage != null ? Number(tx.percentage) : null,
      amount: Number(tx.value) || 0,
    }))
}

function rankFromHistory(user, periodKey) {
  const hist = Array.isArray(user.rank_history) ? user.rank_history : []
  const hit = hist.find(
    (h) =>
      h &&
      (String(h.period) === String(periodKey) ||
        String(h.period_key) === String(periodKey))
  )
  return hit || null
}

/** Si no hay entry en closeds.users, arma uno a partir de txs + rank_history */
function buildSyntheticEntry(user, periodKey, range, allUserTx) {
  const residualLines = residualLinesFromTx(allUserTx, periodKey, range)
  const genLines = genLinesFromTx(allUserTx, periodKey, range)
  const residual = residualLines.reduce((s, r) => s + r.amount, 0)
  const generational = genLines.reduce((s, r) => s + r.amount, 0)
  const savings = sumTxByNames(allUserTx, SAVINGS_TX, periodKey, range)
  const hist = rankFromHistory(user, periodKey)

  const histResidual = hist ? Number(hist.residual_bonus) || 0 : 0
  const histGen = hist ? Number(hist.generational_bonus) || 0 : 0
  const histSav = hist ? Number(hist.savings_bonus) || 0 : 0

  const has =
    residual + generational + savings + histResidual + histGen + histSav > 0 ||
    !!hist

  if (!has) return null

  return {
    user_id: user.id,
    id: user.id,
    name: [user.name, user.lastName].filter(Boolean).join(" "),
    dni: user.dni || null,
    rank: (hist && hist.rank) || user.rank || null,
    points: hist && hist.points != null ? Number(hist.points) : 0,
    reconsumo_points: 0,
    affiliation_points: 0,
    personal_points: 0,
    total_points: hist && hist.points != null ? Number(hist.points) : 0,
    residual_bonus: residual || histResidual,
    residual_lines: residualLines,
    generational_bonus: generational || histGen,
    generational_lines: genLines,
    savings_bonus: savings || histSav,
    tree_snapshot: null,
    _synthetic: true,
  }
}

function periodMeta(closed) {
  if (closed.period_key) {
    return {
      period_key: closed.period_key,
      period_label:
        closed.period_label || labelFromKey(closed.period_key) || "Periodo",
    }
  }
  // period nested
  if (closed.period && closed.period.key) {
    return {
      period_key: closed.period.key,
      period_label: closed.period.label || labelFromKey(closed.period.key) || "Periodo",
    }
  }
  const d = closed.date ? new Date(closed.date) : null
  if (d && !Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const key = `${y}-${String(m).padStart(2, "0")}`
    return {
      period_key: key,
      period_label: closed.period_label || `${MONTHS_ES[m - 1]} ${y}`,
    }
  }
  return {
    period_key: String(closed.id || closed._id || closed.date || "unknown"),
    period_label: closed.period_label || "Periodo",
  }
}

function labelFromKey(key) {
  const m = String(key || "").match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return `${MONTHS_ES[month - 1]} ${m[1]}`
}

/**
 * Rango real del periodo (mismo que admin / Periodos):
 * - Inicio: period.createdAt (cuando se abrió ese mes–año)
 * - Fin: period.closedAt (cuando se cerró)
 * Fallback solo si no hay doc: día 1 del mes-key → cierre del closed.
 */
function periodDateRange(periodKey, closedAt, periodDoc) {
  if (periodDoc) {
    let start = null
    let end = null
    if (periodDoc.createdAt) {
      const s = new Date(periodDoc.createdAt)
      if (!Number.isNaN(s.getTime())) start = s
    }
    if (periodDoc.closedAt) {
      const e = new Date(periodDoc.closedAt)
      if (!Number.isNaN(e.getTime())) end = e
    } else if (closedAt) {
      const e = new Date(closedAt)
      if (!Number.isNaN(e.getTime())) end = e
    }
    if (start || end) {
      return { start, end }
    }
  }

  const m = String(periodKey || "").match(/^(\d{4})-(\d{2})$/)
  if (!m) {
    return {
      start: null,
      end: closedAt ? new Date(closedAt) : null,
    }
  }
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  // Medio día Lima-friendly para evitar corrimiento UTC → día anterior
  const start = new Date(y, mo, 1, 12, 0, 0, 0)
  let end = closedAt ? new Date(closedAt) : new Date(y, mo + 1, 0, 12, 0, 0, 0)
  if (Number.isNaN(end.getTime())) {
    end = new Date(y, mo + 1, 0, 12, 0, 0, 0)
  }
  return { start, end }
}

function countOrgActive(snapshot) {
  if (!snapshot) return { activePeople: 0, activeLevels: 0, activeFrontals: 0 }

  let activePeople = 0
  let activeFrontals = 0
  let maxDepth = 0

  const isActiveNode = (n) => {
    if (!n) return false
    const rank = String(n.rank || "").toLowerCase()
    if (rank && rank !== "none") return true
    if (n.activated || n._activated) return true
    const pts = Number(n.personal_points || n.points || n._total || 0)
    return pts > 0
  }

  const walk = (node, depth) => {
    if (!node) return
    const kids = node.childs || node.children || []
    for (const ch of kids) {
      if (isActiveNode(ch)) {
        activePeople++
        if (depth === 1) activeFrontals++
        if (depth > maxDepth) maxDepth = depth
      }
      walk(ch, depth + 1)
    }
  }

  walk(snapshot, 1)
  return {
    activePeople,
    activeLevels: maxDepth,
    activeFrontals,
  }
}

/**
 * Desglose de puntos de red desde el snapshot del cierre.
 *
 * Motor: total_red (_total) = ∑ (reconsumo + afiliación) de cada persona del árbol.
 *
 * Cierres nuevos: cada nodo trae reconsumo_points / affiliation_points.
 * Cierres viejos: solo traen `points` (reconsumo) y el root `_total`;
 *   → afiliación de red ≈ total − ∑points (no está en el nodo).
 */
function sumNetworkPointBreakdown(snapshot, entry) {
  const result = {
    affiliation: 0,
    reconsumo: 0,
    nodes: 0,
    hasExplicitAffField: false,
    source: "none",
  }

  if (!snapshot) {
    // Sin árbol: solo lo personal del entry
    const ownAff = Number(entry && entry.affiliation_points) || 0
    const ownRec = Number(
      entry && entry.reconsumo_points != null
        ? entry.reconsumo_points
        : entry && entry.points != null
          ? entry.points
          : 0
    )
    result.affiliation = ownAff
    result.reconsumo = ownRec
    result.source = "entry_only"
    return result
  }

  let sumRec = 0
  let sumAff = 0
  let sawAffKey = false

  const walk = (node) => {
    if (!node) return
    result.nodes++
    if (
      Object.prototype.hasOwnProperty.call(node, "affiliation_points") ||
      Object.prototype.hasOwnProperty.call(node, "affiliationPoints")
    ) {
      sawAffKey = true
    }
    const aff = Number(
      node.affiliation_points != null
        ? node.affiliation_points
        : node.affiliationPoints != null
          ? node.affiliationPoints
          : 0
    )
    sumAff += Number.isNaN(aff) ? 0 : aff

    const recRaw =
      node.reconsumo_points != null
        ? node.reconsumo_points
        : node.reconsumoPoints != null
          ? node.reconsumoPoints
          : node.points != null
            ? node.points
            : 0
    const rec = Number(recRaw)
    sumRec += Number.isNaN(rec) ? 0 : rec

    const kids = node.childs || node.children || []
    for (const ch of kids) walk(ch)
  }

  walk(snapshot)

  const groupPts = Number(
    entry &&
      (entry.total_points != null
        ? entry.total_points
        : entry._total != null
          ? entry._total
          : entry.total != null
            ? entry.total
            : 0)
  )

  result.hasExplicitAffField = sawAffKey
  result.reconsumo = sumRec

  if (sawAffKey && sumAff > 0) {
    // Snapshot completo con campos de afiliación
    result.affiliation = sumAff
    result.source = "snapshot_fields"
  } else if (groupPts > 0) {
    // Snapshot viejo/incompleto: lo que no es reconsumo sumado es afiliación de red
    result.affiliation = Math.max(0, Math.round((groupPts - sumRec) * 100) / 100)
    result.reconsumo =
      result.affiliation > 0
        ? Math.max(0, Math.round((groupPts - result.affiliation) * 100) / 100)
        : sumRec > 0
          ? sumRec
          : groupPts
    result.source = "inferred_from_total"
  } else {
    result.affiliation = sumAff
    result.source = "snapshot_points_only"
  }

  return result
}

function sumAmounts(rows, key = "amount") {
  return (rows || []).reduce((s, r) => s + (Number(r[key]) || 0), 0)
}

function mapResidualLines(entry) {
  const lines = entry.residual_lines || entry.residual_bonus_arr || []
  return lines.map((ln, i) => {
    const level =
      ln.level != null
        ? Number(ln.level)
        : ln.n != null
          ? Number(ln.n) + 1
          : null
    const pct =
      ln.percentage != null
        ? Number(ln.percentage)
        : ln.r != null
          ? Number(ln.r) * (ln.rr != null ? Number(ln.rr) : 1)
          : null
    const amount =
      ln.amount != null
        ? Number(ln.amount)
        : ln.val != null && pct != null
          ? Number(ln.val) * pct
          : Number(ln.val) || 0
    return {
      id: `res-${i}`,
      level: level || 0,
      name: ln.name || "—",
      dni: ln.dni || null,
      pr: ln.pr != null ? Number(ln.pr) : ln.val != null ? Number(ln.val) : null,
      percentage: pct,
      amount,
      date: ln.date || null,
    }
  })
}

function mapGenerationalLines(entry) {
  const lines = entry.generational_lines || []
  return lines.map((ln, i) => ({
    id: `gen-${i}`,
    level: ln.generation != null ? Number(ln.generation) : Number(ln.level) || 0,
    name: ln.name || "—",
    dni: ln.dni || null,
    pr: ln.pr != null ? Number(ln.pr) : null,
    percentage: ln.percentage != null ? Number(ln.percentage) : null,
    amount: Number(ln.amount) || 0,
  }))
}

/**
 * Nivel de red del afiliado respecto al socio (1 = frontal / directo).
 * Las txs de afiliación a menudo no guardan `level`, solo `_user_id`.
 */
function networkLevelOf(fromUserId, viewerId, parentById) {
  if (!fromUserId || !viewerId || !parentById) return null
  const root = String(viewerId)
  let id = String(fromUserId)
  if (id === root) return null
  let depth = 0
  const seen = new Set()
  while (id && depth < 30) {
    if (seen.has(id)) return null
    seen.add(id)
    const parent = parentById.get(id)
    if (parent == null || parent === "") return null
    depth++
    if (String(parent) === root) return depth
    id = String(parent)
  }
  return null
}

/** Tablas de bono por plan del afiliado: índice 0 = nivel 1 */
const AFF_PAY_BY_PLAN = {
  basic: [90, 15, 10, 5, 5, 1, 1, 1, 1],
  standard: [300, 60, 20, 10, 10, 5, 5, 5, 5],
  master: [500, 100, 100, 50, 50, 10, 10, 10, 10],
  // alias de UI
  ejecutivo: [90, 15, 10, 5, 5, 1, 1, 1, 1],
  distribuidor: [300, 60, 20, 10, 10, 5, 5, 5, 5],
  empresario: [500, 100, 100, 50, 50, 10, 10, 10, 10],
}

function inferLevelFromAmount(amount, planKey) {
  const amt = Number(amount) || 0
  if (!amt) return null
  const tables = []
  if (planKey && AFF_PAY_BY_PLAN[planKey]) tables.push(AFF_PAY_BY_PLAN[planKey])
  else tables.push(...Object.values(AFF_PAY_BY_PLAN))
  for (const table of tables) {
    const idx = table.findIndex((v) => Number(v) === amt)
    if (idx >= 0) return idx + 1
  }
  return null
}

function planKeyOf(aff) {
  if (!aff) return null
  const p = aff.plan
  if (!p) return null
  if (typeof p === "string") return String(p).toLowerCase()
  return String(p.id || p.key || p.name || "")
    .toLowerCase()
    .trim()
}

function packageLabelOf(aff) {
  if (!aff) return null
  const p = aff.plan
  if (!p) return null
  if (typeof p === "string") return p
  return p.name || p.label || p.id || null
}

function packagePointsOf(aff) {
  if (!aff) return null
  const p = aff.plan
  if (!p || typeof p !== "object") return null
  if (p.affiliation_points != null) return Number(p.affiliation_points)
  if (p.points != null) return Number(p.points)
  return null
}

function packagePriceOf(aff) {
  if (!aff) return null
  if (aff.price != null) return Number(aff.price)
  const p = aff.plan
  if (p && typeof p === "object" && p.amount != null) return Number(p.amount)
  return null
}

function buildParentById(treeNodes, usersList) {
  const parentById = new Map()
  for (const n of treeNodes || []) {
    if (!n || n.id == null) continue
    const parent = n.parent != null ? n.parent : n.parentId
    if (parent != null && parent !== "") {
      parentById.set(String(n.id), String(parent))
    }
  }
  for (const u of usersList || []) {
    if (!u || u.id == null) continue
    const id = String(u.id)
    if (parentById.has(id)) continue
    if (u.parentId != null && u.parentId !== "") {
      parentById.set(id, String(u.parentId))
    }
  }
  return parentById
}

function mapAffiliationTxs(txs, ctx = {}) {
  const {
    viewerId,
    parentById,
    userById = new Map(),
    affById = new Map(),
  } = ctx

  return (txs || []).map((tx, i) => {
    const fromId =
      tx._user_id ||
      tx.from_user_id ||
      tx.fromUserId ||
      tx.affiliate_id ||
      null
    const affId = tx.affiliation_id || tx.affiliationId || null
    const affDoc = affId != null ? affById.get(String(affId)) : null
    const fromUser = fromId != null ? userById.get(String(fromId)) : null

    let level =
      tx.level != null && tx.level !== ""
        ? Number(tx.level)
        : tx.i != null
          ? Number(tx.i) + 1
          : null
    if (level == null || Number.isNaN(level) || level <= 0) {
      level = networkLevelOf(fromId, viewerId, parentById)
    }
    if (level == null || level <= 0) {
      level = inferLevelFromAmount(tx.value, planKeyOf(affDoc))
    }

    const name =
      tx.affiliate_name ||
      tx._user_name ||
      (fromUser
        ? [fromUser.name, fromUser.lastName].filter(Boolean).join(" ")
        : null) ||
      tx.desc ||
      "Afiliación"

    const dni =
      tx.affiliate_dni ||
      tx._user_dni ||
      (fromUser && fromUser.dni) ||
      null

    const pack =
      tx.plan_name ||
      tx.package ||
      packageLabelOf(affDoc) ||
      null

    const points =
      tx.points != null
        ? Number(tx.points)
        : packagePointsOf(affDoc)

    const price = packagePriceOf(affDoc)
    let percentage =
      tx.percentage != null ? Number(tx.percentage) : null
    if (percentage == null && price > 0 && tx.value != null) {
      percentage = Number(tx.value) / price
    }

    return {
      id: tx.id || `aff-${i}`,
      date: tx.date || null,
      name,
      dni,
      package: pack,
      points: points != null && !Number.isNaN(points) ? points : null,
      amount: Number(tx.value) || 0,
      level: level != null && !Number.isNaN(level) ? Number(level) : null,
      percentage,
      virtual: !!tx.virtual,
      from_user_id: fromId,
    }
  })
}

export default async (req, res) => {
  await midd(req, res)

  let { session, period_key: periodKey } = req.query

  session = await Session.findOne({ value: session })
  if (!session) return res.json(error("invalid session"))

  const user = await User.findOne({ id: session.id })
  if (!user) return res.json(error("user not found"))

  if (req.method !== "GET") return res.json(error("method not allowed"))

  try {
    let closeds = await Closed.find({})
    closeds = (closeds || []).slice().sort((a, b) => {
      return new Date(b.date || 0) - new Date(a.date || 0)
    })

    // Transacciones del socio (una sola vez)
    let allUserTx = []
    try {
      allUserTx = (await Transaction.find({ user_id: user.id })) || []
      // compat si hay docs con userId
      if (!allUserTx.length) {
        allUserTx = (await Transaction.find({ userId: user.id })) || []
      }
    } catch (e) {
      console.error("[app/closeds] tx", e)
      allUserTx = []
    }

    // Compras propias del periodo (activaciones + afiliaciones)
    let userActivations = []
    let userAffiliations = []
    try {
      userActivations = (await Activation.find({ userId: user.id })) || []
    } catch (e) {
      console.error("[app/closeds] activations", e)
      userActivations = []
    }
    try {
      userAffiliations = (await Affiliation.find({ userId: user.id })) || []
    } catch (e) {
      console.error("[app/closeds] affiliations", e)
      userAffiliations = []
    }

    // Periodos donde el socio participa (snapshot o transacciones/historico)
    const userCloseds = []
    const seenKeys = new Set()

    for (const c of closeds) {
      const meta = periodMeta(c)
      const period_key = meta.period_key
      let entry = findUserEntry(c, user)

      let periodDoc = null
      try {
        periodDoc = await Period.findOne({ key: period_key })
      } catch (_) {
        periodDoc = null
      }
      const closedAt = (periodDoc && periodDoc.closedAt) || c.date || null
      const range = periodDateRange(period_key, closedAt, periodDoc)

      if (!entry) {
        entry = buildSyntheticEntry(user, period_key, range, allUserTx)
      }

      // Aun sin entry: si hay afiliaciones del periodo, armar entry mínimo
      if (!entry) {
        const hasAff = allUserTx.some((tx) => {
          if (!tx || tx.type === "out") return false
          const name = String(tx.name || "").toLowerCase()
          if (!AFF_NAMES.has(name)) return false
          return txMatchesPeriod(tx, period_key, range)
        })
        if (hasAff) {
          entry = {
            user_id: user.id,
            id: user.id,
            name: [user.name, user.lastName].filter(Boolean).join(" "),
            dni: user.dni || null,
            rank: user.rank || null,
            residual_bonus: 0,
            residual_lines: [],
            generational_bonus: 0,
            generational_lines: [],
            savings_bonus: 0,
            points: 0,
            personal_points: 0,
            total_points: 0,
            _synthetic: true,
          }
        }
      }

      if (!entry) continue
      if (seenKeys.has(String(period_key))) continue
      seenKeys.add(String(period_key))
      userCloseds.push({
        closed: c,
        entry,
        period_key,
        period_label: meta.period_label,
        range,
        closedAt,
      })
    }

    // Periodos solo en rank_history sin documento closed (fallback final)
    const hist = Array.isArray(user.rank_history) ? user.rank_history : []
    for (const h of hist) {
      const key = h && (h.period || h.period_key)
      if (!key || seenKeys.has(String(key))) continue
      let periodDocHist = null
      try {
        periodDocHist = await Period.findOne({ key: String(key) })
      } catch (_) {
        periodDocHist = null
      }
      const histClosed =
        (periodDocHist && periodDocHist.closedAt) || h.date || null
      const range = periodDateRange(key, histClosed, periodDocHist)
      const entry = buildSyntheticEntry(user, key, range, allUserTx)
      if (!entry) continue
      seenKeys.add(String(key))
      userCloseds.push({
        closed: {
          id: `hist-${key}`,
          date: h.date || null,
          period_key: key,
          period_label: labelFromKey(key) || String(key),
          data: {},
          users: [entry],
        },
        entry,
        period_key: key,
        period_label: labelFromKey(key) || String(key),
        range,
        closedAt: h.date || null,
      })
    }

    // Orden por fecha desc
    userCloseds.sort((a, b) => {
      const da = new Date(a.closedAt || a.closed.date || 0).getTime()
      const db = new Date(b.closedAt || b.closed.date || 0).getTime()
      return db - da
    })

    console.log(
      `[app/closeds] user=${user.id} closeds_all=${closeds.length} matched=${userCloseds.length}`
    )

    const periods = userCloseds.map(({ closed, period_key, period_label, closedAt }) => ({
      closed_id: closed.id,
      period_key,
      period_label,
      date: closedAt || closed.date,
    }))

    if (!userCloseds.length) {
      return res.json(
        success({
          name: user.name,
          lastName: user.lastName,
          dni: user.dni || null,
          token: user.token || null,
          photo: user.photo || null,
          id: user.id,
          periods: [],
          report: null,
          debug: {
            closeds_total: closeds.length,
            matched: 0,
            hint:
              closeds.length === 0
                ? "No hay documentos en la colección closeds"
                : "No se encontró tu usuario en los snapshots ni comisiones de cierre",
          },
        })
      )
    }

    let selected =
      periodKey &&
      userCloseds.find((x) => String(x.period_key) === String(periodKey))
    if (!selected) selected = userCloseds[0]

    const { closed, entry, period_key, period_label } = selected
    const closedAt = selected.closedAt || closed.date || null
    // Releer rango desde admin Period (createdAt → closedAt)
    let periodDocSelected = null
    try {
      periodDocSelected = await Period.findOne({ key: period_key })
    } catch (_) {
      periodDocSelected = null
    }
    const range =
      periodDateRange(
        period_key,
        (periodDocSelected && periodDocSelected.closedAt) || closedAt,
        periodDocSelected
      ) ||
      selected.range ||
      periodDateRange(period_key, closedAt, null)

    const isAffTx = (tx) => {
      if (!isRealInTx(tx)) return false
      const name = String(tx.name || "").toLowerCase()
      return AFF_NAMES.has(name)
    }

    let affTxs = allUserTx.filter((tx) => {
      if (!isAffTx(tx)) return false
      return txMatchesPeriod(tx, period_key, range)
    })

    // Virtual (socio inactivo): se listan aparte para no inflar el total real
    const affTxsVirtual = allUserTx.filter((tx) => {
      if (!tx || tx.type === "out") return false
      if (!isVirtualTx(tx)) return false
      const name = String(tx.name || "").toLowerCase()
      if (!AFF_NAMES.has(name)) return false
      return txMatchesPeriod(tx, period_key, range)
    })
    const virtualAffTotal = affTxsVirtual.reduce(
      (s, t) => s + (Number(t.value) || 0),
      0
    )

    // Resolver nivel de red (afiliaciones casi nunca guardan `level` en la tx)
    let parentById = new Map()
    let userById = new Map()
    let affById = new Map()
    if (affTxs.length) {
      try {
        const [treeNodes, allUsers, allAffs] = await Promise.all([
          Tree.find({}),
          User.find({}),
          Affiliation.find({}),
        ])
        parentById = buildParentById(treeNodes || [], allUsers || [])
        for (const u of allUsers || []) {
          if (u && u.id != null) userById.set(String(u.id), u)
        }
        for (const a of allAffs || []) {
          if (a && a.id != null) affById.set(String(a.id), a)
        }
      } catch (e) {
        console.error("[app/closeds] tree/users for aff levels", e)
      }
    }

    // Si entry sin residual_lines pero hay txs, enriquecer
    if (
      (!entry.residual_lines || !entry.residual_lines.length) &&
      !Number(entry.residual_bonus)
    ) {
      const rl = residualLinesFromTx(allUserTx, period_key, range)
      if (rl.length) {
        entry.residual_lines = rl
        entry.residual_bonus = rl.reduce((s, r) => s + r.amount, 0)
      }
    }
    if (
      (!entry.generational_lines || !entry.generational_lines.length) &&
      !Number(entry.generational_bonus)
    ) {
      const gl = genLinesFromTx(allUserTx, period_key, range)
      if (gl.length) {
        entry.generational_lines = gl
        entry.generational_bonus = gl.reduce((s, r) => s + r.amount, 0)
      }
    }
    if (!Number(entry.savings_bonus)) {
      const sav = sumTxByNames(allUserTx, SAVINGS_TX, period_key, range)
      if (sav > 0) entry.savings_bonus = sav
    }

    // Rank bonus lines from txs if missing in closed.data
    let residualLines = mapResidualLines(entry)
    residualLines.sort((a, b) => (a.level || 0) - (b.level || 0))

    let genLines = mapGenerationalLines(entry)
    genLines.sort((a, b) => (a.level || 0) - (b.level || 0))

    const affiliation = {
      total: 0,
      rows: mapAffiliationTxs(affTxs, {
        viewerId: user.id,
        parentById,
        userById,
        affById,
      }),
    }
    affiliation.total = affiliation.rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)

    const residualFromLines = residualLines.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const residual = {
      total: Number(entry.residual_bonus) || residualFromLines || 0,
      rows: residualLines,
    }

    // rank_bonus_logro → Bono Logro; mantenimiento → Bono Recalificación
    const data = closed.data || {}
    const uid = String(user.id)
    let logroRows = (data.rank_bonus_logro || [])
      .filter((r) => String(r.user_id || r.userId) === uid)
      .map((r, i) => ({
        id: `logro-${i}`,
        tipo: "logro",
        rank: r.rank || entry.rank,
        amount: Number(r.amount) || 0,
        label: r.label || "Bono Logro",
      }))
    let mantRows = (data.rank_bonus_mantenimiento || [])
      .filter((r) => String(r.user_id || r.userId) === uid)
      .map((r, i) => ({
        id: `mant-${i}`,
        tipo: "mantenimiento",
        rank: r.rank || entry.rank,
        amount: Number(r.amount) || 0,
        label: r.label || "Bono Recalificación",
      }))

    if (!logroRows.length) {
      logroRows = allUserTx
        .filter((tx) => {
          if (!isRealInTx(tx)) return false
          const name = String(tx.name || "").toLowerCase()
          if (!RANK_LOGRO_TX.has(name)) return false
          return txMatchesPeriod(tx, period_key, range)
        })
        .map((tx, i) => ({
          id: `logro-tx-${i}`,
          tipo: "logro",
          rank: entry.rank,
          amount: Number(tx.value) || 0,
          label: "Bono Logro",
        }))
    }
    if (!mantRows.length) {
      mantRows = allUserTx
        .filter((tx) => {
          if (!isRealInTx(tx)) return false
          const name = String(tx.name || "").toLowerCase()
          if (!RANK_MANT_TX.has(name)) return false
          return txMatchesPeriod(tx, period_key, range)
        })
        .map((tx, i) => ({
          id: `mant-tx-${i}`,
          tipo: "mantenimiento",
          rank: entry.rank,
          amount: Number(tx.value) || 0,
          label: "Bono Recalificación",
        }))
    }

    const rankLead = {
      total: mantRows.reduce((s, r) => s + r.amount, 0),
      rows: mantRows,
    }
    const rankStart = {
      total: logroRows.reduce((s, r) => s + r.amount, 0),
      rows: logroRows,
    }

    const savings = {
      total: Number(entry.savings_bonus) || 0,
      rows:
        Number(entry.savings_bonus) > 0
          ? [
              {
                id: "sav-0",
                label: "Bono Ahorro Sifrah",
                amount: Number(entry.savings_bonus) || 0,
              },
            ]
          : [],
    }

    // Generacional VIP se agrupa como apoyo de residuales o se muestra? Design shows:
    // Afiliaciones, Residuales, Bono Recalificación, Bono Logro, Bono Ahorro
    // Include generational inside residual total+list as "Residuales +" for honesty
    const genTotal = Number(entry.generational_bonus) || 0
    if (genTotal > 0 || genLines.length) {
      residual.total = Number(residual.total || 0) + genTotal
      residual.rows = residual.rows.concat(
        genLines.map((g) => ({
          ...g,
          id: `gen-merged-${g.id}`,
          name: String(g.name || "").includes("Gen")
            ? g.name
            : (g.name || "—") + " (Gen. VIP)",
        }))
      )
      residual.rows.sort((a, b) => (a.level || 0) - (b.level || 0))
    }

    const total =
      Number(affiliation.total || 0) +
      Number(residual.total || 0) +
      Number(rankLead.total || 0) +
      Number(rankStart.total || 0) +
      Number(savings.total || 0)

    const pct = (n) => (total > 0 ? Math.round((Number(n || 0) / total) * 1000) / 10 : 0)

    const breakdown = [
      {
        key: "affiliations",
        label: "Afiliaciones",
        amount: affiliation.total,
        percent: pct(affiliation.total),
        color: "#e91e63",
      },
      {
        key: "residual",
        label: "Residuales",
        amount: residual.total,
        percent: pct(residual.total),
        color: "#22c55e",
      },
      {
        key: "rank_lead",
        label: "Bono Recalificación",
        amount: rankLead.total,
        percent: pct(rankLead.total),
        color: "#7c3aed",
      },
      {
        key: "rank_start",
        label: "Bono Logro",
        amount: rankStart.total,
        percent: pct(rankStart.total),
        color: "#eab308",
      },
      {
        key: "savings",
        label: "Bono Ahorro",
        amount: savings.total,
        percent: pct(savings.total),
        color: "#3b82f6",
      },
    ]

    // Periodo anterior para comparar (misma lógica de sumas que el actual)
    const idx = userCloseds.findIndex((x) => x.period_key === period_key)
    let prevTotal = null
    if (idx >= 0 && idx + 1 < userCloseds.length) {
      const prev = userCloseds[idx + 1]
      const pe = prev.entry || {}
      const pRange = prev.range || periodDateRange(prev.period_key, prev.closedAt)
      const pAff = allUserTx
        .filter((tx) => {
          if (!isAffTx(tx)) return false
          return txMatchesPeriod(tx, prev.period_key, pRange)
        })
        .reduce((s, t) => s + (Number(t.value) || 0), 0)

      let pRes =
        (Number(pe.residual_bonus) || 0) + (Number(pe.generational_bonus) || 0)
      if (!pRes) {
        pRes =
          sumTxByNames(allUserTx, RESIDUAL_TX, prev.period_key, pRange) +
          sumTxByNames(allUserTx, GEN_TX, prev.period_key, pRange)
      }

      let pSav = Number(pe.savings_bonus) || 0
      if (!pSav) {
        pSav = sumTxByNames(allUserTx, SAVINGS_TX, prev.period_key, pRange)
      }

      const pData = (prev.closed && prev.closed.data) || {}
      const pUid = String(user.id)
      let pLogro = (pData.rank_bonus_logro || [])
        .filter((r) => String(r.user_id || r.userId) === pUid)
        .reduce((s, r) => s + (Number(r.amount) || 0), 0)
      let pMant = (pData.rank_bonus_mantenimiento || [])
        .filter((r) => String(r.user_id || r.userId) === pUid)
        .reduce((s, r) => s + (Number(r.amount) || 0), 0)
      if (!pLogro) {
        pLogro = sumTxByNames(allUserTx, RANK_LOGRO_TX, prev.period_key, pRange)
      }
      if (!pMant) {
        pMant = sumTxByNames(allUserTx, RANK_MANT_TX, prev.period_key, pRange)
      }
      prevTotal =
        Math.round((pAff + pRes + pSav + pLogro + pMant) * 100) / 100
    }

    let growthPercent = null
    if (prevTotal != null && prevTotal > 0) {
      growthPercent = Math.round(((total - prevTotal) / prevTotal) * 1000) / 10
    } else if (prevTotal === 0 && total > 0) {
      growthPercent = 100
    } else if (prevTotal === 0 && total === 0) {
      growthPercent = 0
    }

    const org = countOrgActive(entry.tree_snapshot)

    // Puntos del grupo (volumen total de red) del cierre
    const groupPts = Number(
      entry.total_points != null
        ? entry.total_points
        : entry._total != null
          ? entry._total
          : entry.total || 0
    )

    // Afiliación / reconsumo de RED (todo el equipo del snapshot)
    // Ventas realizadas = reconsumo PROPIO del socio (entry.points)
    const snap = entry.tree_snapshot || entry.treeSnapshot || null
    const network = sumNetworkPointBreakdown(snap, entry)

    let networkAffPts = Number(network.affiliation) || 0
    let networkRecPts = Number(network.reconsumo) || 0

    // Coherencia: aff + rec = total de red
    if (groupPts > 0) {
      if (networkAffPts + networkRecPts === 0) {
        networkAffPts = Number(entry.affiliation_points) || 0
        networkRecPts = Math.max(0, groupPts - networkAffPts)
      } else if (Math.abs(networkAffPts + networkRecPts - groupPts) > 0.5) {
        // Ajustar reconsumo como residual del total (fuente de verdad: _total)
        networkRecPts = Math.max(0, Math.round((groupPts - networkAffPts) * 100) / 100)
      }
    }

    // Reconsumo propio del socio (compras personales en puntos)
    const personalReconsumoPts = Number(
      entry.reconsumo_points != null
        ? entry.reconsumo_points
        : entry.points != null
          ? entry.points
          : 0
    )
    const personalPts = Number(
      entry.personal_points != null
        ? entry.personal_points
        : personalReconsumoPts + (Number(entry.affiliation_points) || 0)
    )

    const personalSales = sumPersonalPurchases(
      userActivations,
      userAffiliations,
      period_key,
      range
    )

    const report = {
      period_key,
      period_label:
        (periodDocSelected && periodDocSelected.label) || period_label,
      closed_id: closed.id,
      closed_at:
        (periodDocSelected && periodDocSelected.closedAt) || closedAt,
      period_start: range.start,
      period_end: range.end,
      rank: entry.rank || null,
      payment_status: "En saldo",
      payment_status_label: "En saldo",
      org: {
        active_people: org.activePeople,
        active_levels: org.activeLevels,
        active_frontals: org.activeFrontals,
      },
      totals: {
        total,
        prev_total: prevTotal,
        growth_percent: growthPercent,
        // Solo informativo: afiliaciones virtuales (socio no activo del periodo)
        virtual_affiliations: Math.round(virtualAffTotal * 100) / 100,
      },
      breakdown,
      volume: {
        total_points: groupPts,
        affiliation_points: networkAffPts,
        reconsumo_points: networkRecPts,
        personal_points: personalPts,
        personal_reconsumo_points: personalReconsumoPts,
        personal_sales: personalSales,
        affiliation_share:
          groupPts > 0
            ? Math.round((networkAffPts / groupPts) * 1000) / 10
            : 0,
        reconsumo_share:
          groupPts > 0
            ? Math.round((networkRecPts / groupPts) * 1000) / 10
            : 0,
        _source: network.source,
      },
      details: {
        affiliations: affiliation,
        residual,
        rank_lead: rankLead,
        rank_start: rankStart,
        savings,
      },
    }

    return res.json(
      success({
        name: user.name,
        lastName: user.lastName,
        dni: user.dni || null,
        token: user.token || null,
        photo: user.photo || null,
        id: user.id,
        periods,
        report,
      })
    )
  } catch (e) {
    console.error("[app/closeds]", e)
    return res.status(500).json(error("could not load month closing"))
  }
}
