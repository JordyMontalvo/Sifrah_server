const { MongoClient } = require("mongodb");
const URL = process.env.DB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017";
const name = process.env.DB_NAME || process.env.DB_NAME_FALLBACK || "sifrah";

async function backfill() {
  console.log("Conectando a la base de datos...");
  const client = new MongoClient(URL, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db(name);

  const txs = await db.collection("transactions").find({ period_key: { $exists: false } }).toArray();
  console.log(`Encontradas ${txs.length} transacciones sin period_key.`);

  const periods = await db.collection("periods").find({}).toArray();
  console.log(`Encontrados ${periods.length} periodos.`);

  // Create a helper to find the period by month and year of the transaction
  let updated = 0;
  for (const tx of txs) {
    if (!tx.date) continue;
    const date = new Date(tx.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12

    // Find a period matching this year and month
    let matchedPeriod = periods.find(p => p.year === year && p.month === month);
    
    // If not found, create a fallback label
    const MONTHS_ES = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    
    let periodKey = matchedPeriod ? matchedPeriod.key : `${year}-${String(month).padStart(2, '0')}`;
    let periodLabel = matchedPeriod ? (matchedPeriod.label || matchedPeriod.key) : `${MONTHS_ES[month - 1]} ${year}`;

    await db.collection("transactions").updateOne(
      { _id: tx._id },
      { $set: { period_key: periodKey, period_label: periodLabel } }
    );
    updated++;
    
    if (updated % 500 === 0) {
      console.log(`Actualizadas ${updated} transacciones...`);
    }
  }

  console.log(`¡Completado! Se actualizaron ${updated} transacciones históricas con su ciclo correspondiente.`);
  await client.close();
}

backfill().catch(console.error);
