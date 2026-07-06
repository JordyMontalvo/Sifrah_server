/**
 * Cálculo de progreso de rango alineado con el motor Go (cierre_engine/engine).
 */

const { RANK_ORDER, rankIndex } = require("./rankBonusConfig")

const RANK_DISPLAY_LABELS = [
  "Activo",
  "Bronce",
  "Plata",
  "Oro",
  "Rubí",
  "Esmeralda",
  "Diamante",
  "Doble diamante",
  "Triple diamante",
  "Diamante imperial",
  "Embajador Sifrah",
]

/** Configuración de rangos (misma tabla que engine/config.go). */
const RANK_CONFIG = [
  {
    rank: "EMBAJADOR SIFRAH",
    minimumFrontals: 6,
    thresholdPoints: 600000,
    maximumLargeLeg: 100000,
    reconsumoRequired: 160,
  },
  {
    rank: "DIAMANTE IMPERIAL",
    minimumFrontals: 6,
    thresholdPoints: 300000,
    maximumLargeLeg: 55000,
    reconsumoRequired: 160,
  },
  {
    rank: "TRIPLE DIAMANTE",
    minimumFrontals: 5,
    thresholdPoints: 170000,
    maximumLargeLeg: 37500,
    reconsumoRequired: 160,
  },
  {
    rank: "DOBLE DIAMANTE",
    minimumFrontals: 5,
    thresholdPoints: 85000,
    maximumLargeLeg: 19000,
    reconsumoRequired: 160,
  },
  {
    rank: "DIAMANTE",
    minimumFrontals: 4,
    thresholdPoints: 45000,
    maximumLargeLeg: 12000,
    reconsumoRequired: 160,
  },
  {
    rank: "ESMERALDA",
    minimumFrontals: 4,
    thresholdPoints: 20000,
    maximumLargeLeg: 5500,
    reconsumoRequired: 160,
  },
  {
    rank: "RUBÍ",
    minimumFrontals: 4,
    thresholdPoints: 7500,
    maximumLargeLeg: 2100,
    reconsumoRequired: 160,
  },
  {
    rank: "ORO",
    minimumFrontals: 3,
    thresholdPoints: 3500,
    maximumLargeLeg: 1350,
    reconsumoRequired: 160,
  },
  {
    rank: "PLATA",
    minimumFrontals: 3,
    thresholdPoints: 1500,
    maximumLargeLeg: 600,
    reconsumoRequired: 160,
  },
  {
    rank: "BRONCE",
    minimumFrontals: 2,
    thresholdPoints: 500,
    maximumLargeLeg: 300,
    reconsumoRequired: 160,
  },
  {
    rank: "ACTIVO",
    minimumFrontals: 0,
    thresholdPoints: 1,
    maximumLargeLeg: 0,
    reconsumoRequired: 120,
  },
]

const RANK_CONFIG_BY_NAME = Object.fromEntries(RANK_CONFIG.map((r) => [r.rank, r]))

function displayLabel(rankName) {
  const idx = rankIndex(rankName)
  if (idx >= 0 && idx < RANK_DISPLAY_LABELS.length) return RANK_DISPLAY_LABELS[idx]
  return rankName || "Ninguno"
}

function isEliminated(user) {
  return user && user.status === "eliminated"
}

function personalPoints(user) {
  return Number(user?.points || 0) + Number(user?.affiliation_points || 0)
}

function reconsumoPoints(user) {
  return Math.max(Number(user?.points || 0), Number(user?.affiliation_points || 0))
}

function calculateTotalPoints(id, usersById, treeById, memo = new Map()) {
  if (!id) return 0
  if (memo.has(id)) return memo.get(id)

  const user = usersById.get(id)
  if (!user || isEliminated(user)) {
    memo.set(id, 0)
    return 0
  }

  let total = personalPoints(user)
  const node = treeById.get(id)
  for (const childId of node?.childs || []) {
    total += calculateTotalPoints(childId, usersById, treeById, memo)
  }

  memo.set(id, total)
  return total
}

function getActiveLegValues(userId, usersById, treeById, memo) {
  const node = treeById.get(userId)
  if (!node) return []

  const legs = []
  for (const childId of node.childs || []) {
    const child = usersById.get(childId)
    if (!child || isEliminated(child)) continue
    const pts = calculateTotalPoints(childId, usersById, treeById, memo)
    if (pts > 0) legs.push(pts)
  }

  legs.sort((a, b) => b - a)
  return legs
}

function applyVmpToLegs(legs, personal, vmp) {
  const calcLegs = [...legs]
  const personalAdded = calcLegs.length > 0

  if (calcLegs.length > 0) {
    calcLegs[calcLegs.length - 1] += personal
  }

  let totalWithVmp = 0
  if (calcLegs.length === 0) {
    totalWithVmp = personal
    if (vmp > 0 && totalWithVmp > vmp) totalWithVmp = vmp
    return { totalWithVmp, calcLegs, personalAdded: false }
  }

  for (const legVal of calcLegs) {
    if (vmp > 0 && legVal > vmp) totalWithVmp += vmp
    else totalWithVmp += legVal
  }

  return { totalWithVmp, calcLegs, personalAdded }
}

function calculateRankForUser(user, usersById, treeById, memo) {
  if (!user || isEliminated(user)) return "none"

  const legs = getActiveLegValues(user.id, usersById, treeById, memo)
  const activeLines = legs.length
  const reconsumo = reconsumoPoints(user)
  const personal = personalPoints(user)
  const skipReconsumo = !!(user._activated || user.activated)

  for (const r of RANK_CONFIG) {
    if (!skipReconsumo && reconsumo < r.reconsumoRequired) continue
    if (activeLines < r.minimumFrontals) continue

    const { totalWithVmp } = applyVmpToLegs(legs, personal, r.maximumLargeLeg)
    if (totalWithVmp >= r.thresholdPoints) return r.rank
  }

  return user.activated || user._activated ? "ACTIVO" : "none"
}

function buildLegDetails(user, usersById, treeById, targetConfig, memo) {
  const node = treeById.get(user.id)
  const personal = personalPoints(user)
  const vmp = targetConfig.maximumLargeLeg || 0

  const rawLegs = []
  for (const childId of node?.childs || []) {
    const child = usersById.get(childId)
    if (!child || isEliminated(child)) continue
    const generated = calculateTotalPoints(childId, usersById, treeById, memo)
    if (generated > 0) {
      rawLegs.push({ childId, generated })
    }
  }

  rawLegs.sort((a, b) => b.generated - a.generated)

  const shortestIdx = rawLegs.length > 0 ? rawLegs.length - 1 : -1
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

  return rawLegs.map((leg, index) => {
    const generated = leg.generated
    const includesPersonal = index === shortestIdx && personal > 0
    const valueWithPersonal = generated + (includesPersonal ? personal : 0)
    const valid = vmp > 0 && valueWithPersonal > vmp ? vmp : valueWithPersonal
    const vmpReached = vmp > 0 && generated >= vmp

    let status = null
    let statusType = null
    if (vmpReached) {
      status = "VMP alcanzado"
      statusType = "vmp"
    } else if (includesPersonal) {
      status = "Incluye puntos personales"
      statusType = "personal"
    }

    return {
      letter: letters[index] || String(index + 1),
      generated,
      personalAdded: includesPersonal ? personal : 0,
      valid,
      vmpReached,
      status,
      statusType,
    }
  })
}

function computeRankProgress(user, usersList, treeList) {
  const usersById = new Map(usersList.map((u) => [u.id, u]))
  const treeById = new Map(treeList.map((n) => [n.id, n]))
  const memo = new Map()

  const currentRank = calculateRankForUser(user, usersById, treeById, memo)
  const currentIdx = rankIndex(currentRank)

  let targetRank = null
  let targetConfig = null
  if (currentIdx >= 0 && currentIdx < RANK_ORDER.length - 1) {
    targetRank = RANK_ORDER[currentIdx + 1]
    targetConfig = RANK_CONFIG_BY_NAME[targetRank]
  } else if (currentRank === "none" || currentIdx < 0) {
    targetRank = "ACTIVO"
    targetConfig = RANK_CONFIG_BY_NAME.ACTIVO
  } else {
    targetRank = currentRank
    targetConfig = RANK_CONFIG_BY_NAME[currentRank]
  }

  const legs = getActiveLegValues(user.id, usersById, treeById, memo)
  const personal = personalPoints(user)
  const reconsumo = reconsumoPoints(user)
  const activeLines = legs.length
  const skipReconsumo = !!(user._activated || user.activated)

  const { totalWithVmp } = applyVmpToLegs(legs, personal, targetConfig.maximumLargeLeg)
  const validPoints = Math.round(totalWithVmp)
  const threshold = targetConfig.thresholdPoints
  const pointsMissing = Math.max(0, threshold - validPoints)
  const progressPercent = threshold > 0 ? Math.min(100, Math.round((validPoints / threshold) * 100)) : 0

  const legDetails = buildLegDetails(user, usersById, treeById, targetConfig, memo)

  const requirements = [
    {
      key: "reconsumo",
      label: "Reconsumo propio",
      current: Math.round(reconsumo),
      required: targetConfig.reconsumoRequired,
      met: skipReconsumo || reconsumo >= targetConfig.reconsumoRequired,
      display: `${Math.round(reconsumo)} / ${targetConfig.reconsumoRequired} pts`,
      pendingText: null,
    },
    {
      key: "lines",
      label: "Líneas activas",
      current: activeLines,
      required: targetConfig.minimumFrontals,
      met: activeLines >= targetConfig.minimumFrontals,
      display: `${activeLines} / ${targetConfig.minimumFrontals}`,
      pendingText: null,
    },
    {
      key: "points",
      label: "Puntos válidos",
      current: validPoints,
      required: threshold,
      met: validPoints >= threshold,
      display: pointsMissing > 0 ? `Faltan ${pointsMissing} pts` : `${validPoints} / ${threshold} pts`,
      pendingText: pointsMissing > 0 ? `Faltan ${pointsMissing} pts` : null,
    },
  ]

  return {
    currentRank,
    currentRankLabel: displayLabel(currentRank),
    targetRank,
    targetRankLabel: displayLabel(targetRank),
    vmp: targetConfig.maximumLargeLeg,
    validPoints,
    thresholdPoints: threshold,
    pointsMissing,
    progressPercent,
    activeLines,
    minimumFrontals: targetConfig.minimumFrontals,
    reconsumo: Math.round(reconsumo),
    reconsumoRequired: targetConfig.reconsumoRequired,
    reconsumoMet: skipReconsumo || reconsumo >= targetConfig.reconsumoRequired,
    linesMet: activeLines >= targetConfig.minimumFrontals,
    pointsMet: validPoints >= threshold,
    legs: legDetails,
    requirements,
    tip: "Tu puntaje personal siempre se suma a la pierna más corta que tenga disponibilidad según el VMP del rango objetivo.",
    isMaxRank: currentIdx === RANK_ORDER.length - 1,
  }
}

module.exports = {
  RANK_CONFIG,
  RANK_DISPLAY_LABELS,
  computeRankProgress,
  displayLabel,
  calculateRankForUser,
}
