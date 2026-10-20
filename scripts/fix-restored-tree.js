const path = require("path");
const { MongoClient } = require('mongodb');
// Cargar .env de forma independiente del directorio actual (mismo patron que
// los demas scripts del repo): resolver contra __dirname, no contra el CWD.
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const URL = process.env.DB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || process.env.DB_NAME_FALLBACK || "sifrah";

// Correccion de datos (una sola vez): reincorpora al arbol las cuentas que ya
// fueron restauradas (status active + reactivated_at) pero que siguen sin
// aparecer como directas de su patrocinador. No reconstruye la downline antigua;
// solo reinserta el nodo bajo su patrocinador. Idempotente.
//
// Uso (desde server/, en el droplet que tiene acceso a la Mongo de AWS):
//   node scripts/fix-restored-tree.js --dry-run   # muestra que tocaria, no escribe
//   node scripts/fix-restored-tree.js             # aplica los cambios

const DRY_RUN = process.argv.includes("--dry-run");

async function run() {
  console.log(`[${new Date().toISOString()}] fix-restored-tree ${DRY_RUN ? "(DRY-RUN)" : "(APLICANDO)"}`);

  const client = new MongoClient(URL, { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const usersCol = db.collection("users");
    const treeCol = db.collection("tree");

    // Cuentas restauradas (fueron reactivadas) y actualmente activas.
    const restored = await usersCol
      .find({ status: "active", reactivated_at: { $exists: true } })
      .toArray();
    console.log(`Cuentas restauradas a revisar: ${restored.length}`);

    let fixed = 0;
    let alreadyOk = 0;
    let skipped = 0;

    for (const user of restored) {
      if (!user.id) { skipped++; continue; }
      // No reinsertar cuentas con credenciales de eliminacion (dni del_...):
      // son cuentas que deben permanecer eliminadas aunque su status quedara en
      // active. Se dejan fuera del arbol a proposito.
      if (typeof user.dni === "string" && user.dni.startsWith("del_")) {
        console.log(`  - ${user.id} (${user.dni}): credencial eliminada (del_), se omite.`);
        skipped++;
        continue;
      }
      if (!user.parentId) {
        console.log(`  - ${user.id} (${user.dni}): sin parentId/patrocinador, se omite.`);
        skipped++;
        continue;
      }

      const sponsor = await usersCol.findOne({ id: user.parentId });
      if (!sponsor) {
        console.log(`  - ${user.id}: patrocinador ${user.parentId} no encontrado, se omite.`);
        skipped++;
        continue;
      }

      const _id = sponsor.coverage && sponsor.coverage.id ? sponsor.coverage.id : sponsor.id;
      const parentNode = await treeCol.findOne({ id: _id });
      if (!parentNode) {
        console.log(`  - ${user.id}: nodo del patrocinador ${_id} no existe en 'tree', se omite.`);
        skipped++;
        continue;
      }

      const inParent = (parentNode.childs || []).some((c) => String(c) === String(user.id));
      if (inParent) { alreadyOk++; continue; }

      console.log(`  -> ${user.id} (${user.dni}) se reinsertara como directo de ${_id}`);
      if (!DRY_RUN) {
        await treeCol.updateOne(
          { id: _id },
          { $set: { childs: [...(parentNode.childs || []), user.id] } }
        );
        const ownNode = await treeCol.findOne({ id: user.id });
        if (ownNode) {
          await treeCol.updateOne(
            { id: user.id },
            { $set: { parent: _id, childs: ownNode.childs || [] } }
          );
        } else {
          await treeCol.insertOne({ id: user.id, childs: [], parent: _id });
        }
      }
      fixed++;
    }

    console.log(`[${new Date().toISOString()}] Hecho. Reinsertadas: ${fixed}, ya correctas: ${alreadyOk}, omitidas: ${skipped}.`);
    if (DRY_RUN) console.log("DRY-RUN: no se escribio nada. Quita --dry-run para aplicar.");
  } catch (err) {
    console.error("Error en fix-restored-tree:", err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

run();
