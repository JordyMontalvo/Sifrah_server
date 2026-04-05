const {
  normalizeRank,
  rankIndex,
  rankAtIndex,
  getBonusRow,
  RANK_ORDER,
} = require("./rankBonusConfig")

/**
 * @typedef {{ tipo: string, rank: string, amount: number, user_id?: string }} RankBonusPaymentLike
 */

/**
 * Máximo índice de rango jamás registrado en cierres históricos (colección closeds).
 * @param {Array<{ date?: Date|string, users?: Array<Record<string, unknown>> }>} closeds
 * @returns {Map<string, number>} userId -> max rankIndex
 */
function maxClosedRankIndexFromHistory(closeds) {
  const map = new Map()
  const sorted = [...(closeds || [])].sort(
    (a, b) => new Date(a.date || 0) - new Date(b.date || 0)
  )
  for (const doc of sorted) {
    const users = doc.users || []
    for (const u of users) {
      const uid = u.user_id || u.userId
      if (!uid) continue
      const idx = rankIndex(u.rank)
      if (idx < 0) continue
      const prev = map.get(uid) ?? -1
      if (idx > prev) map.set(uid, idx)
    }
  }
  return map
}

/**
 * Máximo índice de rango en el arreglo rank_history del usuario (manual + cierres).
 */
function maxRankIndexFromRankHistory(rankHistory) {
  if (!Array.isArray(rankHistory) || !rankHistory.length) return -1
  let max = -1
  for (const entry of rankHistory) {
    const idx = rankIndex(entry.rank)
    if (idx > max) max = idx
  }
  return max
}

/**
 * Por usuario: max( rango máx en closeds, rango máx en rank_history ).
 * Así el historial manual en admin cuenta como “ya alcanzó” ese rango para no repetir logros.
 * @param {Array} closeds
 * @param {Array<{ id: string, rank_history?: unknown[] }>} usersList
 */
function buildMaxEverRankIndexMap(closeds, usersList) {
  const fromClosed = maxClosedRankIndexFromHistory(closeds || [])
  const map = new Map(fromClosed)
  for (const u of usersList || []) {
    if (!u || !u.id) continue
    const h = maxRankIndexFromRankHistory(u.rank_history)
    if (h < 0) continue
    const prev = map.get(u.id) ?? -1
    if (h > prev) map.set(u.id, h)
  }
  return map
}

function buildPaymentStateFromDocs(paymentDocs) {
  /** @type {Map<string, RankBonusPaymentLike[]>} */
  const byUser = new Map()
  for (const p of paymentDocs || []) {
    const uid = p.user_id || p.userId
    if (!uid) continue
    if (!byUser.has(uid)) byUser.set(uid, [])
    byUser.get(uid).push({
      tipo: p.tipo || p.type,
      rank: normalizeRank(p.rank) || p.rank,
      amount: Number(p.amount || 0),
    })
  }
  return { byUser }
}

function hasLogroPaid(state, userId, rank) {
  const n = normalizeRank(rank)
  if (!n) return false
  const list = state.byUser.get(userId) || []
  return list.some((p) => p.tipo === "logro" && normalizeRank(p.rank) === n)
}

function accumulatedForRank(state, userId, rank) {
  const n = normalizeRank(rank)
  if (!n) return 0
  const list = state.byUser.get(userId) || []
  return list
    .filter((p) => normalizeRank(p.rank) === n)
    .reduce((s, p) => s + Number(p.amount || 0), 0)
}

/**
 * Propone líneas de bono logro/mantenimiento para un cierre simulado.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.closedRank - rango calculado por el motor en este cierre
 * @param {number} opts.maxEverIdx - máximo índice de rango en closeds previos (-1 si nunca cerró con rango)
 * @param {{ byUser: Map<string, RankBonusPaymentLike[]> }} opts.paymentState
 * @returns {{ lines: Array<{ tipo: string, rank: string, amount: number, reason: string }>, logLines: string[] }}
 */
function evaluateRankBonusesForUser(opts) {
  const { userId, closedRank, maxEverIdx, paymentState } = opts
  const logLines = []
  const lines = []

  const closedIdx = rankIndex(closedRank)
  const closedNorm = normalizeRank(closedRank)

  if (closedIdx < 0 || !closedNorm) {
    logLines.push(`  [${userId}] Sin rango cerrado (${closedRank || "vacío"}) → sin bono por rango`)
    return { lines, logLines }
  }

  const rowClosed = getBonusRow(closedNorm)
  if (!rowClosed) {
    logLines.push(`  [${userId}] Rango sin fila en tabla: ${closedNorm}`)
    return { lines, logLines }
  }

  const maxEver = maxEverIdx >= 0 ? maxEverIdx : -1
  logLines.push(
    `  [${userId}] Cierre en ${closedNorm} (idx=${closedIdx}), máx histórico (cierres+rank_history) idx=${maxEver}`
  )

  if (closedIdx > maxEver) {
    for (let i = maxEver + 1; i <= closedIdx; i++) {
      const r = rankAtIndex(i)
      if (!r) continue
      const row = getBonusRow(r)
      if (!row || row.logro <= 0) continue
      if (hasLogroPaid(paymentState, userId, r)) {
        logLines.push(`    Salto: ${r} — logro ya pagado, omitido`)
        continue
      }
      const acc = accumulatedForRank(paymentState, userId, r)
      const room = row.cap - acc
      const pay = Math.min(row.logro, Math.max(0, room))
      if (pay <= 0) {
        logLines.push(`    Salto: ${r} — tope agotado (acum=${acc}, cap=${row.cap})`)
        continue
      }
      lines.push({
        tipo: "logro",
        rank: r,
        amount: pay,
        reason: `primer cierre (o salto) a ${r}`,
      })
      logLines.push(`    + LOGRO ${r}: ${pay} (cap ${row.cap}, acum previo ${acc})`)
    }
    return { lines, logLines }
  }

  if (closedIdx <= maxEver) {
    const r = closedNorm
    if (!hasLogroPaid(paymentState, userId, r)) {
      logLines.push(
        `    Mantenimiento: ${r} — no hay logro previo registrado para este rango → sin mantenimiento`
      )
      return { lines, logLines }
    }
    const row = getBonusRow(r)
    if (!row || row.maintenance <= 0) {
      logLines.push(`    ${r}: sin mantenimiento configurado (Plata/Oro único logro)`)
      return { lines, logLines }
    }
    const acc = accumulatedForRank(paymentState, userId, r)
    const room = row.cap - acc
    const pay = Math.min(row.maintenance, Math.max(0, room))
    if (pay <= 0) {
      logLines.push(`    MANT ${r}: tope alcanzado (acum=${acc}, cap=${row.cap})`)
      return { lines, logLines }
    }
    lines.push({
      tipo: "mantenimiento",
      rank: r,
      amount: pay,
      reason: `repite cierre en ${r} (bajó desde pico o repite mismo rango pagable)`,
    })
    logLines.push(`    + MANTENIMIENTO ${r}: ${pay} (cap ${row.cap}, acum previo ${acc})`)
  }

  return { lines, logLines }
}

module.exports = {
  RANK_ORDER,
  maxClosedRankIndexFromHistory,
  maxRankIndexFromRankHistory,
  buildMaxEverRankIndexMap,
  buildPaymentStateFromDocs,
  hasLogroPaid,
  accumulatedForRank,
  evaluateRankBonusesForUser,
}
