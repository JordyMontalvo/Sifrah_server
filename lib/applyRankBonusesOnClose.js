const db = require("../components/db")
const libMod = require("../components/lib")
const lib = libMod.default || libMod

const {
  maxClosedRankIndexFromHistory,
  maxRankIndexFromRankHistory,
  buildMaxEverRankIndexMap,
  buildPaymentStateFromDocs,
  evaluateRankBonusesForUser,
} = require("./rankBonusEngine")

/**
 * Histórico de rango máximo por usuario excluyendo el cierre más reciente (el que acaba de escribir Go).
 */
function maxRankIndexBeforeLatestClose(allCloseds) {
  if (!allCloseds || !allCloseds.length) {
    return { latest: null, maxByUserPrior: new Map() }
  }
  const sortedDesc = [...allCloseds].sort(
    (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
  )
  const latest = sortedDesc[0]
  const prior = allCloseds.filter((d) => d.id !== latest.id)
  const maxByUserPrior = maxClosedRankIndexFromHistory(prior)
  return { latest, maxByUserPrior }
}

/**
 * Tras un cierre real del motor Go: inserta rank_bonus_payments y transacciones virtuales de ingreso.
 * @param {{ periodKey: string, rand?: () => string }} opts
 */
async function applyRankBonusesAfterGoClose(opts) {
  const { periodKey } = opts
  const rand = opts.rand || lib.rand.bind(lib)
  const { Closed, Transaction, RankBonusPayment, User } = db

  const allCloseds = await Closed.find({})
  const { latest, maxByUserPrior } = maxRankIndexBeforeLatestClose(allCloseds)

  if (!latest || !latest.users || !latest.users.length) {
    return {
      applied: [],
      totalAmount: 0,
      error: "Sin documento de cierre reciente o sin usuarios en users[]",
    }
  }

  const allUsers = await User.find({})
  const userById = new Map((allUsers || []).map((u) => [u.id, u]))

  let paymentDocs = []
  try {
    paymentDocs = await RankBonusPayment.find({})
  } catch (e) {
    paymentDocs = []
  }
  const payState = buildPaymentStateFromDocs(paymentDocs)

  const applied = []
  const now = new Date()

  for (const u of latest.users) {
    const uid = u.user_id || u.userId
    const rank = u.rank
    if (!uid || !rank) continue

    let maxEverIdx = maxByUserPrior.has(uid) ? maxByUserPrior.get(uid) : -1
    const userDoc = userById.get(uid)
    // Go acaba de hacer $push en rank_history (UpdateUserRanks). Si contamos esa entrada,
    // maxEverIdx queda igual al rango de ESTE cierre y evaluateRankBonusesForUser no paga logro.
    const rh = userDoc?.rank_history
    const rhBeforeThisClose =
      Array.isArray(rh) && rh.length > 0 ? rh.slice(0, -1) : []
    const hMax = maxRankIndexFromRankHistory(rhBeforeThisClose)
    if (hMax > maxEverIdx) maxEverIdx = hMax
    const { lines } = evaluateRankBonusesForUser({
      userId: uid,
      closedRank: rank,
      maxEverIdx,
      paymentState: payState,
    })

    for (const line of lines) {
      const payId = rand()
      const txId = rand()
      const txName =
        line.tipo === "logro" ? "bono logro rango" : "bono mantenimiento rango"

      await RankBonusPayment.insert({
        id: payId,
        user_id: uid,
        tipo: line.tipo,
        rank: line.rank,
        amount: line.amount,
        period_key: periodKey || "",
        closed_id: latest.id,
        reason: line.reason || "",
        created_at: now,
      })

      // Importante: estos bonos deben reflejarse en el saldo disponible y en el historial de movimientos.
      // Si se marcan como `virtual: true`, pueden:
      // - quedar en "saldo no disponible" (_balance) en dashboard
      // - ser ocultados por la lógica de compensación de "closed reset" (transactions.js)
      await Transaction.insert({
        id: txId,
        date: now,
        user_id: uid,
        type: "in",
        value: line.amount,
        name: txName,
        desc: `${line.rank} — ${line.reason || line.tipo}`,
        virtual: false,
      })

      applied.push({
        user_id: uid,
        user_name: u.name || "",
        user_dni: (userDoc && userDoc.dni) || "",
        tipo: line.tipo,
        rank: line.rank,
        amount: line.amount,
        payment_id: payId,
        transaction_id: txId,
      })

      if (!payState.byUser.has(uid)) payState.byUser.set(uid, [])
      payState.byUser.get(uid).push({
        tipo: line.tipo,
        rank: line.rank,
        amount: line.amount,
      })
    }
  }

  const totalAmount = applied.reduce((s, a) => s + a.amount, 0)

  // Persistir resumen dentro del cierre para trazabilidad en admin/historial.
  // Guardamos solo lo necesario (logro/mantenimiento, monto y ids) para no inflar el documento.
  try {
    const logro = applied.filter((a) => a.tipo === "logro")
    const mantenimiento = applied.filter((a) => a.tipo === "mantenimiento")
    await Closed.update(
      { id: latest.id },
      {
        "data.rank_bonus_total": totalAmount,
        "data.rank_bonus_period_key": periodKey || "",
        "data.rank_bonus_logro": logro,
        "data.rank_bonus_mantenimiento": mantenimiento,
        "data.rank_bonus_applied_count": applied.length,
      }
    )
  } catch (e) {
    // No debe tumbar el cierre si falla el update del resumen.
    console.error("⚠️ No se pudo guardar resumen rank_bonus en closeds.data:", e)
  }

  return {
    applied,
    totalAmount,
    closed_id: latest.id,
    period_key: periodKey,
    logro_count: applied.filter((a) => a.tipo === "logro").length,
    mantenimiento_count: applied.filter((a) => a.tipo === "mantenimiento").length,
  }
}

/**
 * Preview admin: mismas reglas que al guardar, sin escribir en DB.
 * @param {Array} usersList mismos usuarios que en User.find (con rank_history) para respetar historial manual.
 */
function enrichPreviewTreeWithRankBonuses(treeNodes, allCloseds, paymentDocs, usersList) {
  const maxByUser = buildMaxEverRankIndexMap(allCloseds || [], usersList || [])
  const payState = buildPaymentStateFromDocs(paymentDocs || [])

  const byId = new Map((usersList || []).map((u) => [u.id, u]))
  return (treeNodes || []).map((node) => {
    const uDoc = byId.get(node.id)
    const { lines } = evaluateRankBonusesForUser({
      userId: node.id,
      closedRank: node.rank,
      maxEverIdx: maxByUser.has(node.id) ? maxByUser.get(node.id) : -1,
      paymentState: payState,
    })
    const total = lines.reduce((s, l) => s + l.amount, 0)
    return {
      ...node,
      dni: (uDoc && uDoc.dni) || node.dni || "",
      rank_bonus_lines: lines,
      rank_bonus_total: total,
    }
  })
}

module.exports = {
  applyRankBonusesAfterGoClose,
  enrichPreviewTreeWithRankBonuses,
  maxRankIndexBeforeLatestClose,
}
