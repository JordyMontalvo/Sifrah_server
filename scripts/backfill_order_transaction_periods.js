/**
 * Corrige period_key/period_label en transacciones vinculadas a órdenes aprobadas.
 * No usa la fecha de la transacción: hereda el período de activación/afiliación/canje.
 *
 * Uso: node scripts/backfill_order_transaction_periods.js
 */
require("dotenv").config();
const { MongoClient } = require("mongodb");

const URL = process.env.DB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017";
const name = process.env.DB_NAME || process.env.DB_NAME_FALLBACK || "sifrah";

const EGRESS_BY_ORDER = {
  activations: { names: ["activation"], types: ["standard", null, undefined] },
  affiliations: { names: ["affiliation"] },
  savings_redemptions: {
    names: ["savings_bonus_redemption", "savings_bonus_refund"],
    order_type: "savings_bonus",
  },
};

async function syncOrderTransactions(db, order, egressNames) {
  if (!order.period_key || !order.transactions?.length) return { updated: 0, skipped: 0 };

  let updated = 0;
  let skipped = 0;

  for (const txId of order.transactions) {
    const tx = await db.collection("transactions").findOne({ id: txId });
    if (!tx) {
      skipped++;
      continue;
    }
    if (egressNames.length && !egressNames.includes(tx.name)) {
      skipped++;
      continue;
    }
    if (tx.period_key === order.period_key && tx.period_label === order.period_label) {
      skipped++;
      continue;
    }
    await db.collection("transactions").updateOne(
      { id: txId },
      {
        $set: {
          period_key: order.period_key,
          period_label: order.period_label,
        },
      }
    );
    updated++;
  }

  return { updated, skipped };
}

async function backfill() {
  const client = new MongoClient(URL, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db(name);

  let totalUpdated = 0;
  let totalSkipped = 0;

  const activations = await db
    .collection("activations")
    .find({
      status: "approved",
      period_key: { $exists: true, $ne: null },
      transactions: { $exists: true, $not: { $size: 0 } },
      $or: [{ order_type: { $exists: false } }, { order_type: { $ne: "savings_bonus" } }],
    })
    .toArray();

  console.log(`Activaciones aprobadas: ${activations.length}`);
  for (const order of activations) {
    const r = await syncOrderTransactions(db, order, EGRESS_BY_ORDER.activations.names);
    totalUpdated += r.updated;
    totalSkipped += r.skipped;
  }

  const affiliations = await db
    .collection("affiliations")
    .find({
      status: "approved",
      period_key: { $exists: true, $ne: null },
      transactions: { $exists: true, $not: { $size: 0 } },
    })
    .toArray();

  console.log(`Afiliaciones aprobadas: ${affiliations.length}`);
  for (const order of affiliations) {
    const r = await syncOrderTransactions(db, order, EGRESS_BY_ORDER.affiliations.names);
    totalUpdated += r.updated;
    totalSkipped += r.skipped;
  }

  const savingsOrders = await db
    .collection("activations")
    .find({
      status: "approved",
      order_type: "savings_bonus",
      period_key: { $exists: true, $ne: null },
      transactions: { $exists: true, $not: { $size: 0 } },
    })
    .toArray();

  console.log(`Canjes Bono Ahorro aprobados: ${savingsOrders.length}`);
  for (const order of savingsOrders) {
    const r = await syncOrderTransactions(db, order, EGRESS_BY_ORDER.savings_redemptions.names);
    totalUpdated += r.updated;
    totalSkipped += r.skipped;
  }

  // Bonos de afiliación/activación por affiliation_id / activation_id
  const bonusTx = await db
    .collection("transactions")
    .find({
      period_key: { $in: [null, ""] },
      $or: [
        { name: "affiliation bonus" },
        { name: "migration bonus" },
        { name: "activation bonnus promo" },
      ],
    })
    .toArray();

  console.log(`Bonos sin período (por id de orden): ${bonusTx.length}`);
  for (const tx of bonusTx) {
    let order = null;
    if (tx.affiliation_id) {
      order = await db.collection("affiliations").findOne({ id: tx.affiliation_id });
    } else if (tx.activation_id) {
      order = await db.collection("activations").findOne({ id: tx.activation_id });
    }
    if (!order?.period_key) continue;
    await db.collection("transactions").updateOne(
      { id: tx.id },
      { $set: { period_key: order.period_key, period_label: order.period_label } }
    );
    totalUpdated++;
  }

  console.log(`Listo. Actualizadas: ${totalUpdated}. Omitidas: ${totalSkipped}.`);
  await client.close();
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
