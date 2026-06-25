/**
 * Sincroniza period_key/period_label en transacciones vinculadas a una orden/compra.
 * No calcula ciclo por fecha: solo copia el período del documento origen.
 */

async function updateTransactionsPeriod(
  Transaction,
  transactionIds,
  periodKey,
  periodLabel,
  { type, names } = {}
) {
  if (!periodKey || !transactionIds?.length) return 0;

  let updated = 0;
  for (const transactionId of transactionIds) {
    const tx = await Transaction.findOne({ id: transactionId });
    if (!tx) continue;
    if (type && tx.type !== type) continue;
    if (names && names.length && !names.includes(tx.name)) continue;

    if (tx.period_key === periodKey && tx.period_label === periodLabel) continue;

    await Transaction.update(
      { id: transactionId },
      { period_key: periodKey, period_label: periodLabel }
    );
    updated++;
  }
  return updated;
}

/** Egresos por saldo u otros cargos de una orden (activación, afiliación, canje, etc.). */
async function syncOrderEgressPeriod(
  Transaction,
  transactionIds,
  periodKey,
  periodLabel,
  egressNames
) {
  return updateTransactionsPeriod(Transaction, transactionIds, periodKey, periodLabel, {
    type: "out",
    names: egressNames,
  });
}

/** Todas las transacciones vinculadas en el array de la orden. */
async function syncOrderTransactionsPeriod(
  Transaction,
  transactionIds,
  periodKey,
  periodLabel
) {
  return updateTransactionsPeriod(Transaction, transactionIds, periodKey, periodLabel);
}

module.exports = {
  updateTransactionsPeriod,
  syncOrderEgressPeriod,
  syncOrderTransactionsPeriod,
};
