const db = require("../components/db")
const libMod = require("../components/lib")
const lib = libMod.default || libMod

const {
  maxClosedRankIndexFromHistory,
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
  const { Closed, Transaction, RankBonusPayment } = db

  const allCloseds = await Closed.find({})
  const { latest, maxByUserPrior } = maxRankIndexBeforeLatestClose(allCloseds)

  if (!latest || !latest.users || !latest.users.length) {
    return {
      applied: [],
      totalAmount: 0,
      message: "Sin documento de cierre reciente o sin usuarios en users[]",
    }
  }

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

    const maxEverIdx = maxByUserPrior.has(uid) ? maxByUserPrior.get(uid) : -1
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

      await Transaction.insert({
        id: txId,
        date: now,
        user_id: uid,
        type: "in",
        value: line.amount,
        name: txName,
        desc: `${line.rank} — ${line.reason || line.tipo}`,
        virtual: true,
      })

      applied.push({
        user_id: uid,
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
  return { applied, totalAmount, closed_id: latest.id, period_key: periodKey }
}

/**
 * Preview admin: mismas reglas que al guardar, sin escribir en DB.
 */
function enrichPreviewTreeWithRankBonuses(treeNodes, allCloseds, paymentDocs) {
  const maxByUser = maxClosedRankIndexFromHistory(allCloseds || [])
  const payState = buildPaymentStateFromDocs(paymentDocs || [])

  return (treeNodes || []).map((node) => {
    const { lines } = evaluateRankBonusesForUser({
      userId: node.id,
      closedRank: node.rank,
      maxEverIdx: maxByUser.has(node.id) ? maxByUser.get(node.id) : -1,
      paymentState: payState,
    })
    const total = lines.reduce((s, l) => s + l.amount, 0)
    return {
      ...node,
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
