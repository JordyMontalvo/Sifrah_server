const { MongoClient } = require("mongodb");
const URL = process.env.DB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017";
const name = process.env.DB_NAME || "sifrah";

async function inspect() {
  const client = new MongoClient(URL, { useUnifiedTopology: true });
  try {
    await client.connect();
    console.log("Conectado a MongoDB");
    const db = client.db(name);
    
    // Obtener todas las colecciones
    const collections = await db.collections();
    console.log(`Encontradas ${collections.length} colecciones.`);
    
    for (let collection of collections) {
      const colName = collection.collectionName;
      const count = await collection.countDocuments();
      console.log(`\n--- Colección: ${colName} (Documentos: ${count}) ---`);
      
      if (count > 0) {
        const sample = await collection.findOne({});
        console.log(JSON.stringify(sample, null, 2));
      } else {
        console.log("(vacía)");
      }
    }
  } catch (err) {
    console.error("Error conectando a MongoDB:", err);
  } finally {
    await client.close();
  }
}

inspect();
