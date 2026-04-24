/**
 * Bonos por rango (logro único + mantenimiento mensual + tope acumulado).
 * Tabla alineada con especificación operativa (Plata→Embajador; Bronce sin pago).
 */

/** Orden ascendente de rangos del motor Go (índice = jerarquía). */
const RANK_ORDER = [
  "ACTIVO",
  "BRONCE",
  "PLATA",
  "ORO",
  "RUBÍ",
  "ESMERALDA",
  "DIAMANTE",
  "DOBLE DIAMANTE",
  "TRIPLE DIAMANTE",
  "DIAMANTE IMPERIAL",
  "EMBAJADOR SIFRAH",
]

/**
 * @typedef {{ cap: number, logro: number, maintenance: number }} RankBonusRow
 * cap: tope acumulado (logro + mantenimientos) para ese rango.
 * logro: pago único la primera vez que se cierra en ese rango (salto).
 * maintenance: pago por cierre repetido en ese rango (Rubí+), 0 en Plata/Oro.
 */
const RANK_BONUS_TABLE = {
  ACTIVO: { cap: 0, logro: 0, maintenance: 0 },
  BRONCE: { cap: 0, logro: 0, maintenance: 0 },
  PLATA: { cap: 200, logro: 200, maintenance: 0 },
  ORO: { cap: 300, logro: 300, maintenance: 0 },
  RUBÍ: { cap: 1000, logro: 1000, maintenance: 0 },
  ESMERALDA: { cap: 2000, logro: 1500, maintenance: 250 },
  DIAMANTE: { cap: 5000, logro: 3000, maintenance: 500 },
  "DOBLE DIAMANTE": { cap: 10000, logro: 4000, maintenance: 1000 },
  "TRIPLE DIAMANTE": { cap: 25000, logro: 6250, maintenance: 1250 },
  "DIAMANTE IMPERIAL": { cap: 50000, logro: 12500, maintenance: 2500 },
  "EMBAJADOR SIFRAH": { cap: 100000, logro: 25000, maintenance: 5000 },
}

const ALIASES = {
  RUBI: "RUBÍ",
  none: null,
  "": null,
}

function normalizeRank(rank) {
  if (rank == null || rank === "") return null
  const s = String(rank).trim()
  if (s === "none") return null
  if (ALIASES[s] !== undefined) return ALIASES[s]
  if (RANK_BONUS_TABLE[s]) return s
  const upper = s.toUpperCase()
  if (RANK_BONUS_TABLE[upper]) return upper
  return s
}

function rankIndex(rank) {
  const n = normalizeRank(rank)
  if (!n) return -1
  const i = RANK_ORDER.indexOf(n)
  return i
}

function rankAtIndex(i) {
  return RANK_ORDER[i] || null
}

function getBonusRow(rank) {
  const n = normalizeRank(rank)
  if (!n) return null
  return RANK_BONUS_TABLE[n] || null
}

function paysAnyBonus(rank) {
  const row = getBonusRow(rank)
  return row && (row.logro > 0 || row.maintenance > 0 || row.cap > 0)
}

module.exports = {
  RANK_ORDER,
  RANK_BONUS_TABLE,
  normalizeRank,
  rankIndex,
  rankAtIndex,
  getBonusRow,
  paysAnyBonus,
}
