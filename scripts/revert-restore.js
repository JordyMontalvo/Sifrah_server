const path = require("path");
const { MongoClient } = require("mongodb");
// Cargar .env de forma independiente del directorio actual.
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const URL = process.env.DB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || process.env.DB_NAME_FALLBACK || "sifrah";

// Revierte la restauracion de UNA cuenta: la deja como eliminada.
// - La saca del arbol (la quita de los childs de su patrocinador).
// - Pone su status en "eliminated".
// NO re-renombra credenciales (si ya venia con dni del_..., se conserva).
// Idempotente y con --dry-run.
//
// Uso (desde server/, en el droplet):
//   node scripts/revert-restore.js <userId> --dry-run
//   node scripts/revert-restore.js <userId>

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const USER_ID = args.find((a) => !a.startsWith("--"));

async function run() {
  if (!USER_ID) {
    console.error("Falta el userId. Uso: node scripts/revert-restore.js <userId> [--dry-run]");
    process.exitCode = 1;
    return;
  }

  console.log(`[${new Date().toISOString()}] revert-restore ${USER_ID} ${DRY_RUN ? "(DRY-RUN)" : "(APLICANDO)"}`);

  const client = new MongoClient(URL, { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const usersCol = db.collection("users");
    const treeCol = db.collection("tree");

    const user = await usersCol.findOne({ id: USER_ID });
    if (!user) {
      console.error(`Usuario ${USER_ID} no encontrado.`);
      process.exitCode = 1;
      return;
    }
    console.log(`Usuario: ${user.id} (dni: ${user.dni}) status actual: ${user.status}`);

    // 1. Sacar del arbol: quitarlo de los childs de su patrocinador.
    let removedFromTree = false;
    if (user.parentId) {
      const sponsor = await usersCol.findOne({ id: user.parentId });
      if (sponsor) {
        const sponsorNodeId = sponsor.coverage && sponsor.coverage.id ? sponsor.coverage.id : sponsor.id;
        const parentNode = await treeCol.findOne({ id: sponsorNodeId });
        if (parentNode && (parentNode.childs || []).some((c) => String(c) === String(user.id))) {
          const updated = (parentNode.childs || []).filter((c) => String(c) !== String(user.id));
          console.log(`  - se quitara del arbol: childs de ${sponsorNodeId} ${parentNode.childs.length} -> ${updated.length}`);
          if (!DRY_RUN) {
            await treeCol.updateOne({ id: sponsorNodeId }, { $set: { childs: updated } });
          }
          removedFromTree = true;
        } else {
          console.log(`  - ya no figura en el arbol de su patrocinador (${sponsorNodeId}).`);
        }
      }
    }

    // 2. Volver status a "eliminated".
    let statusChanged = false;
    if (user.status !== "eliminated") {
      console.log(`  - status ${user.status} -> eliminated`);
      if (!DRY_RUN) {
        await usersCol.updateOne(
          { id: USER_ID },
          { $set: { status: "eliminated", statusReason: "Restauracion revertida: se mantiene eliminada" } }
        );
      }
      statusChanged = true;
    } else {
      console.log(`  - status ya es eliminated.`);
    }

    console.log(`[${new Date().toISOString()}] Hecho. removedFromTree=${removedFromTree}, statusChanged=${statusChanged}.`);
    if (DRY_RUN) console.log("DRY-RUN: no se escribio nada. Quita --dry-run para aplicar.");
  } catch (err) {
    console.error("Error en revert-restore:", err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

run();
