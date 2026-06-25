/**
 * Corrige period_key/period_label en egresos "activation" vinculados a activaciones aprobadas.
 * Uso: node scripts/backfill_activation_egress_period.js
 */
require("dotenv").config();
const { MongoClient } = require("mongodb");

const URL = process.env.DB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017";
const name = process.env.DB_NAME || process.env.DB_NAME_FALLBACK || "sifrah";

async function backfill() {
  const client = new MongoClient(URL, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db(name);

  const activations = await db
    .collection("activations")
    .find({
      status: "approved",
      period_key: { $exists: true, $ne: null },
      transactions: { $exists: true, $not: { $size: 0 } },
    })
    .toArray();

  console.log(`Activaciones aprobadas con transacciones: ${activations.length}`);

  let updated = 0;
  let skipped = 0;

  for (const activation of activations) {
    for (const txId of activation.transactions) {
      const tx = await db.collection("transactions").findOne({ id: txId });
      if (!tx || tx.name !== "activation" || tx.type !== "out") {
        skipped++;
        continue;
      }
      if (
        tx.period_key === activation.period_key &&
        tx.period_label === activation.period_label
      ) {
        skipped++;
        continue;
      }
      await db.collection("transactions").updateOne(
        { id: txId },
        {
          $set: {
            period_key: activation.period_key,
            period_label: activation.period_label,
          },
        }
      );
      updated++;
    }
  }

  console.log(`Egresos actualizados: ${updated}. Omitidos: ${skipped}.`);
  await client.close();
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
