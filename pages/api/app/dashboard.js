import db from "../../../components/db"
import lib from "../../../components/lib"
import { normalizeRank, rankAtIndex, rankIndex, RANK_ORDER } from "../../../lib/rankBonusConfig"
import {
  RANK_IMAGE_ID,
  emptyRankImagesDoc,
  getHistoricalRankImageKey,
} from "../../../lib/rankImages"

const { User, Session, Transaction, Tree, Banner, Plan, DashboardConfig, Closed } = db
const { error, success, acum, midd, model } = lib

const RANK_DISPLAY_LABELS = [
  "Activo",
  "Bronce",
  "Plata",
  "Oro",
  "Ruby",
  "Esmeralda",
  "Diamante",
  "Doble diamante",
  "Triple diamante",
  "Diamante imperial",
  "Embajador Sifrah",
]

function stripAccents(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/** Índice en RANK_ORDER (motor Go). Incluye códigos legacy de la app (star, ruby, etc.). */
function resolveRankToIndex(rank) {
  const fromEngine = rankIndex(rank)
  if (fromEngine >= 0) return fromEngine

  const raw = String(rank || "").trim()
  if (!raw || raw.toLowerCase() === "none") return -1

  const key = stripAccents(raw).toLowerCase()
  const legacy = {
    active: 0,
    activo: 0,
    star: 1,
    bronce: 1,
    master: 1,
    silver: 2,
    plata: 2,
    si: 2,
    platino: 2,
    gold: 3,
    oro: 3,
    sapphire: 4,
    zafiro: 4,
    rubi: 4,
    ruby: 4,
    emerald: 5,
    esmeralda: 5,
    diamond: 6,
    diamante: 6,
    "doble diamante": 7,
    "triple diamante": 8,
    "diamante estrella": 9,
    "diamante imperial": 9,
    "embajador sifrah": 10,
  }
  if (legacy[key] !== undefined) return legacy[key]

  const upper = stripAccents(raw).toUpperCase()
  const fromUpper = rankIndex(upper)
  if (fromUpper >= 0) return fromUpper

  return rankIndex(raw.toUpperCase())
}

function indexToDisplayLabel(index) {
  if (index < 0 || index >= RANK_DISPLAY_LABELS.length) return null
  return RANK_DISPLAY_LABELS[index]
}

function rankToDashboardCode(rankName) {
  if (!rankName) return "none"
  const normalized = normalizeRank(rankName)
  const toCode = {
    ACTIVO: "active",
    BRONCE: "star",
    PLATA: "silver",
    ORO: "gold",
    "RUBÍ": "ruby",
    ESMERALDA: "emerald",
    DIAMANTE: "diamond",
    "DOBLE DIAMANTE": "DOBLE DIAMANTE",
    "TRIPLE DIAMANTE": "TRIPLE DIAMANTE",
    "DIAMANTE IMPERIAL": "DIAMANTE ESTRELLA",
    "EMBAJADOR SIFRAH": "DIAMANTE ESTRELLA",
  }
  if (normalized && toCode[normalized]) return toCode[normalized]

  const idx = resolveRankToIndex(rankName)
  if (idx >= 0) return rankToDashboardCode(rankAtIndex(idx))

  return String(rankName).toLowerCase()
}

function collectHistoricalRankCandidates(user, closeds) {
  const candidates = []

  const push = (rank, entry) => {
    const idx = resolveRankToIndex(rank)
    if (idx < 0) return
    candidates.push({ index: idx, rank, entry: entry || { rank } })
  }

  for (const entry of user.rank_history || []) {
    if (!entry) continue
    push(entry.rank, entry)
  }

  push(user.rank)

  for (const doc of closeds || []) {
    for (const u of doc.users || []) {
      const uid = u.user_id || u.userId
      if (uid !== user.id) continue
      const d = doc.date ? new Date(doc.date) : null
      push(u.rank, {
        rank: u.rank,
        period:
          u.period ||
          (d && !Number.isNaN(d.getTime())
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
            : null),
        date: doc.date,
      })
    }
  }

  if (!candidates.length && (user.activated || user._activated)) {
    push("ACTIVO")
  }

  return candidates
}

function resolvePeakHistoricalRank(user, closeds) {
  const candidates = collectHistoricalRankCandidates(user, closeds)
  if (!candidates.length) {
    return {
      index: -1,
      rank: null,
      entry: null,
      label: null,
    }
  }
  const peak = candidates.reduce((best, current) =>
    current.index > best.index ? current : best
  )
  return {
    index: peak.index,
    rank: peak.rank,
    entry: peak.entry,
    label: indexToDisplayLabel(peak.index),
  }
}

function buildHistoricalRankSubtitle(peakEntry, historicalRankIndex) {
  if (historicalRankIndex < 0) {
    return "Aún sin rango en historial"
  }
  const period = peakEntry?.period ? String(peakEntry.period).trim() : ""
  if (period) return `Máximo alcanzado en período ${period}`
  if (peakEntry?.date) {
    return `Máximo alcanzado: ${new Date(peakEntry.date).toLocaleDateString("es-PE")}`
  }
  return "Máximo rango histórico alcanzado"
}

const D = ['id', 'name', 'lastName', 'affiliated', 'activated', 'tree', 'email', 'phone', 'address', 'rank', 'points', 'parentId', 'total_points']
export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query




  // valid session
  session = await Session.findOne({ value: session })
  if (!session) return res.json(error('invalid session'))

  // GET plans
  const plans = await Plan.find({}); // Traer todos los planes


  // get USER
  const user = await User.findOne({ id: session.id })

  let directs = await User.find({ parentId: user.id })
  directs = directs.filter((direct) => direct.status !== "eliminated")

  directs = directs.map(direct => {
    const d = model(direct, D)
    return { ...d }
  })

  const node = await Tree.findOne({ id: user.id })
  console.log({ node })

  const childs = node.childs
  console.log({ childs })

  let frontals = await User.find({ id: { $in: childs } })
  frontals = frontals.filter((frontal) => frontal.status !== "eliminated")
  console.log({ frontals })

  // get transactions
  const transactions = await Transaction.find({ user_id: user.id, virtual: { $in: [null, false] } })
  const virtualTransactions = await Transaction.find({ user_id: user.id, virtual: true })

  const ins = transactions.filter(t => t.type === 'in' && t.wallet_tipo !== 'BONO_AHORRO').reduce((sum, t) => sum + Number(t.value || 0), 0)
  const outs = transactions.filter(t => t.type === 'out' && t.wallet_tipo !== 'BONO_AHORRO').reduce((sum, t) => sum + Number(t.value || 0), 0)
  const sifrahIns = transactions.filter(t => t.type === 'in' && t.wallet_tipo === 'BONO_AHORRO').reduce((sum, t) => sum + Number(t.value || 0), 0)
  const sifrahOuts = transactions.filter(t => t.type === 'out' && t.wallet_tipo === 'BONO_AHORRO').reduce((sum, t) => sum + Number(t.value || 0), 0)
  
  const insVirtual = acum(virtualTransactions, { type: 'in' }, 'value')
  const outsVirtual = acum(virtualTransactions, { type: 'out' }, 'value')


  const banner = await Banner.findOne({})

  // GET dashboard config (Bono Viaje text) - Primero buscar configuración específica del usuario
  let dashboardConfig = await DashboardConfig.findOne({ id: 'travel_bonus', userId: user.id })

  // Si no existe configuración específica del usuario, buscar la configuración global
  // (configuraciones que no tienen el campo userId)
  if (!dashboardConfig) {
    dashboardConfig = await DashboardConfig.findOne({
      id: 'travel_bonus',
      userId: { $exists: false }
    })
  }

  // Si no existe ninguna configuración, crear una global por defecto
  if (!dashboardConfig) {
    dashboardConfig = {
      id: 'travel_bonus',
      text: 'Tu progreso hacia el Bono Viaje se actualizará próximamente. ¡Sigue trabajando para alcanzar tus objetivos!'
    }
    await DashboardConfig.insert(dashboardConfig)
  }

  // get full tree for counting and rank calculations
  const allTree = await Tree.find({})
  const treeMap = allTree.reduce((a, b) => { a[b.id] = b; return a }, {})

  function countNetwork(id) {
    if (!treeMap[id]) return 0
    const node = treeMap[id]
    let count = 0
    if (node.childs) {
      node.childs.forEach(childId => {
        count += 1 + countNetwork(childId)
      })
    }
    return count
  }

  const n_affiliates_total = countNetwork(user.id)

  // Determine current provisional rank based on real performance
  const rankRequirements = {
    'star': { points: 300, childs: 2 },
    'master': { points: 900, childs: 2 },
    'silver': { points: 1800, childs: 3 },
    'gold': { points: 3300, childs: 3 },
    'sapphire': { points: 9000, childs: 4 },
    'RUBI': { points: 21000, childs: 4 },
    'DIAMANTE': { points: 60000, childs: 5 },
    'DOBLE DIAMANTE': { points: 115000, childs: 5 },
    'TRIPLE DIAMANTE': { points: 225000, childs: 6 },
    'DIAMANTE ESTRELLA': { points: 520000, childs: 6 }
  }

  const rankOrder = ['none', 'active', 'star', 'master', 'silver', 'gold', 'sapphire', 'RUBI', 'DIAMANTE', 'DOBLE DIAMANTE', 'TRIPLE DIAMANTE', 'DIAMANTE ESTRELLA']

  let provisionalRank = (user.activated || user._activated) ? 'active' : 'none'
  const currentTotalPoints = user.total_points || 0
  const currentDirects = directs.length || 0

  // Check highest met rank
  for (let i = 2; i < rankOrder.length; i++) {
    const rName = rankOrder[i]
    const req = rankRequirements[rName]
    if (currentTotalPoints >= req.points && currentDirects >= req.childs) {
      provisionalRank = rName
    } else {
      break // Doesn't meet this or higher
    }
  }

  const provisionalRankIndex = rankOrder.indexOf(provisionalRank)
  const nextRankName = provisionalRankIndex < rankOrder.length - 1 ? rankOrder[provisionalRankIndex + 1] : null

  let nextRankPercentage = 0
  if (nextRankName) {
    const req = rankRequirements[nextRankName] || (nextRankName === 'active' ? { points: 1, childs: 0 } : null)
    if (req) {
      if (nextRankName === 'active') {
        nextRankPercentage = (user.activated || user._activated) ? 100 : 0
      } else {
        const pointsProgress = Math.min(100, (currentTotalPoints * 100) / req.points)
        const childsProgress = Math.min(100, (currentDirects * 100) / req.childs)
        nextRankPercentage = Math.floor((pointsProgress + childsProgress) / 2)
      }
    }
  }

  const closeds = await Closed.find({})
  const peak = resolvePeakHistoricalRank(user, closeds)
  const historicalRankIndex = peak.index
  const peakEntry = peak.entry

  const historicalRankRaw =
    historicalRankIndex >= 0 ? rankAtIndex(historicalRankIndex) : null
  const historicalRank = rankToDashboardCode(
    historicalRankRaw || peak.rank || user.rank || "none"
  )
  const historicalRankLabel =
    peak.label ||
    indexToDisplayLabel(historicalRankIndex) ||
    (historicalRank && historicalRank !== "none" ? historicalRank : null)
  const historicalRankPercentage =
    historicalRankIndex >= 0 && RANK_ORDER.length > 1
      ? Math.floor((historicalRankIndex / (RANK_ORDER.length - 1)) * 100)
      : 0
  const historicalRankSubtitle = buildHistoricalRankSubtitle(
    peakEntry,
    historicalRankIndex
  )

  let rankImages = await Banner.findOne({ id: RANK_IMAGE_ID })
  if (!rankImages) rankImages = emptyRankImagesDoc()
  const historicalRankImageKey = getHistoricalRankImageKey(historicalRankIndex)
  const configuredRankImage =
    historicalRankImageKey && rankImages[historicalRankImageKey]
      ? String(rankImages[historicalRankImageKey]).trim()
      : ""
  const historicalRankImage = configuredRankImage || null

  // response
  return res.json(success({
    name: user.name,
    lastName: user.lastName,
    affiliated: user.affiliated,
    _activated: user._activated,
    activated: user.activated,
    plan: user.plan,
    country: user.country,
    photo: user.photo,
    tree: user.tree,
    email: user.email,
    token: user.token,
    address: user.address,
    directs,
    frontals,

    banner,
    ins,
    insVirtual,
    outs,
    balance: (ins - outs),
    sifrahIns,
    sifrahBalance: (sifrahIns - sifrahOuts),
    totalEarned: ins + insVirtual + sifrahIns,
    _balance: (insVirtual - outsVirtual),
    rank: user.rank,
    points: user.points,
    plans,
    total_points: user.total_points, // <-- Agregar todos los planes a la respuesta
    travelBonusText: dashboardConfig.text || 'Tu progreso hacia el Bono Viaje se actualizará próximamente. ¡Sigue trabajando para alcanzar tus objetivos!',
    n_affiliates_total,
    nextRankName,
    nextRankPercentage,
    provisionalRank,
    historicalRank,
    historicalRankLabel,
    historicalRankPercentage,
    historicalRankSubtitle,
    historicalRankImage,
  }))
}
