const path = require("path");
// Cargar .env de forma independiente del directorio actual (mismo patron que
// los demas scripts del repo): resolver contra __dirname, no contra el CWD.
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env.local"), quiet: true });
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const { reinsertIntoSponsorTree } = require("../lib/treeReinsert.js");

// Correccion de datos: restaura los AFILIADOS que el motor de cierre dio de baja
// por "Inactividad de 6 meses" (regla eliminada: el codigo de un afiliado es
// permanente). Solo toca cuentas con status eliminated + affiliated true + esa
// razon, eliminadas en el cierre indicado (fecha UTC del prefijo del_<ts>_).
//
// Por cada cuenta:
//   - Quita el prefijo del_<ts>_ de dni/email/phone y el " (Eliminado)" del nombre.
//   - status active, reactivated_at, n_inactives 0.
//   - La reinserta en el arbol como DIRECTO de su patrocinador (sin reconstruir
//     su downline antigua, igual que la accion "reactivate" del admin). Si el
//     patrocinador esta eliminado, sube al ancestro activo mas cercano (misma
//     semantica que la compresion del arbol al eliminar).
//   - Deja un registro en audit_logs.
// Se omite (y se reporta) si su DNI o email ya pertenece a otra cuenta no eliminada.
// Idempotente: una cuenta ya restaurada deja de cumplir el filtro.
//
// Uso (desde server/, en el droplet que tiene acceso a la Mongo de AWS):
//   node scripts/restore-eliminated-affiliates.js --closing-date 2026-11-04 --dry-run
//   node scripts/restore-eliminated-affiliates.js --closing-date 2026-11-04

const INACTIVITY_REASON = /Inactividad de 6 meses/;
const DEL_PREFIX = /^del_(\d+)_/;
const RESTORE_REASON = "Restaurada: codigo permanente de afiliado (sin baja por inactividad)";

function stripDelPrefix(value) {
  return typeof value === "string" ? value.replace(DEL_PREFIX, "") : value;
}

/** Timestamp (segundos) del prefijo del_<ts>_ o null. */
function delTimestamp(dni) {
  const m = typeof dni === "string" ? dni.match(DEL_PREFIX) : null;
  return m ? Number(m[1]) : null;
}

/** true si la cuenta es un afiliado dado de baja por inactividad en el dia UTC dado (YYYY-MM-DD). */
function isRestorable(user, closingDate) {
  if (!user || user.status !== "eliminated" || user.affiliated !== true) return false;
  if (!INACTIVITY_REASON.test(user.statusReason || "")) return false;
  const ts = delTimestamp(user.dni);
  if (ts == null) return false;
  const from = Date.parse(`${closingDate}T00:00:00Z`) / 1000;
  return ts >= from && ts < from + 24 * 60 * 60;
}

/** Campos a escribir en users para restaurar la cuenta. */
function buildRestorePatch(user, now) {
  return {
    status: "active",
    statusReason: RESTORE_REASON,
    reactivated_at: now,
    n_inactives: 0,
    dni: stripDelPrefix(user.dni),
    email: stripDelPrefix(user.email),
    phone: stripDelPrefix(user.phone),
    name: typeof user.name === "string" ? user.name.replace(/\s*\(Eliminado\)\s*$/, "").trimEnd() : user.name,
  };
}

/** Ordena para restaurar primero a los patrocinadores que tambien estan en el lote. */
function orderSponsorsFirst(users) {
  const byId = new Map(users.map((u) => [String(u.id), u]));
  const done = new Set();
  const out = [];
  const visit = (u, stack = new Set()) => {
    const id = String(u.id);
    if (done.has(id) || stack.has(id)) return;
    stack.add(id);
    const parent = u.parentId != null ? byId.get(String(u.parentId)) : null;
    if (parent) visit(parent, stack);
    done.add(id);
    out.push(u);
  };
  users.forEach((u) => visit(u));
  return out;
}

/**
 * Patrocinador activo mas cercano subiendo por parentId. Las cuentas de
 * `restoringIds` cuentan como activas (se restauran antes en el mismo lote).
 * @returns {Promise<string|null>}
 */
async function resolveActiveSponsor(startId, getUser, restoringIds = new Set(), maxDepth = 100) {
  let id = startId != null ? String(startId) : null;
  for (let depth = 0; id && depth < maxDepth; depth++) {
    const u = await getUser(id);
    if (!u) return null;
    if (u.status !== "eliminated" || restoringIds.has(id)) return id;
    id = u.parentId != null ? String(u.parentId) : null;
  }
  return null;
}

function parseArgs(argv) {
  const i = argv.indexOf("--closing-date");
  const closingDate = i >= 0 ? argv[i + 1] : null;
  if (!closingDate || !/^\d{4}-\d{2}-\d{2}$/.test(closingDate)) {
    throw new Error("Falta --closing-date YYYY-MM-DD (fecha UTC del cierre)");
  }
  return { closingDate, dryRun: argv.includes("--dry-run") };
}

async function run() {
  const { MongoClient } = require("mongodb");
  const { closingDate, dryRun } = parseArgs(process.argv);
  const URL = process.env.DB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.DB_NAME || process.env.DB_NAME_FALLBACK || "sifrah";
  console.log(`[${new Date().toISOString()}] restore-eliminated-affiliates cierre=${closingDate} ${dryRun ? "(DRY-RUN)" : "(APLICANDO)"}`);

  const client = new MongoClient(URL, { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const usersCol = db.collection("users");
    const treeCol = db.collection("tree");
    const auditCol = db.collection("audit_logs");

    const candidates = (await usersCol
      .find({ status: "eliminated", affiliated: true, statusReason: INACTIVITY_REASON, dni: DEL_PREFIX })
      .toArray()).filter((u) => isRestorable(u, closingDate));
    const ordered = orderSponsorsFirst(candidates);
    const restoringIds = new Set(ordered.map((u) => String(u.id)));
    console.log(`Afiliados a restaurar en el cierre ${closingDate}: ${ordered.length}`);

    // Adaptadores minimos para reinsertIntoSponsorTree (interfaz de lib/db).
    const User = { findOne: (q) => usersCol.findOne(q) };
    const Tree = {
      findOne: (q) => treeCol.findOne(q),
      update: (q, set) => treeCol.updateOne(q, { $set: set }),
      insert: (doc) => treeCol.insertOne(doc),
    };
    const getUser = (id) => usersCol.findOne({ id }, { projection: { id: 1, status: 1, parentId: 1 } });

    let restored = 0;
    let skipped = 0;
    for (const user of ordered) {
      const now = new Date();
      const patch = buildRestorePatch(user, now);
      const label = `${user.id} (${patch.dni}) ${patch.name || ""} ${user.lastName || ""}`.trim();

      const dniTaken = await usersCol.findOne({ dni: patch.dni, status: { $ne: "eliminated" } }, { projection: { id: 1 } });
      const emailTaken = patch.email
        ? await usersCol.findOne({ email: patch.email, status: { $ne: "eliminated" }, id: { $ne: user.id } }, { projection: { id: 1 } })
        : null;
      if (dniTaken || emailTaken) {
        console.log(`  - OMITIDA ${label}: ${dniTaken ? `DNI en uso por ${dniTaken.id}` : `email en uso por ${emailTaken.id}`}`);
        skipped++;
        continue;
      }

      const sponsorId = await resolveActiveSponsor(user.parentId, getUser, restoringIds);
      if (!sponsorId) {
        console.log(`  - OMITIDA ${label}: sin patrocinador activo en la linea ascendente`);
        skipped++;
        continue;
      }
      const sponsorChanged = String(sponsorId) !== String(user.parentId);
      console.log(`  -> ${label} | patrocinador ${sponsorId}${sponsorChanged ? ` (antes ${user.parentId}, eliminado)` : ""}`);

      if (!dryRun) {
        if (sponsorChanged) patch.parentId = sponsorId;
        await usersCol.updateOne({ id: user.id, status: "eliminated" }, { $set: patch });
        const treeReinserted = await reinsertIntoSponsorTree(Tree, User, { ...user, parentId: sponsorId });
        await auditCol.insertOne({
          id: Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2),
          date: now,
          collection_name: "users",
          action: "reactivate",
          target_id: user.id,
          user_id: user.id,
          admin_id: "script_restore_eliminated_affiliates",
          state_before: { status: "eliminated", statusReason: user.statusReason, dni: user.dni, parentId: user.parentId || null },
          state_after: { status: "active", reason: RESTORE_REASON, dni: patch.dni, parentId: sponsorId, tree_reinserted: treeReinserted },
        });
      }
      restored++;
    }

    console.log(`[${new Date().toISOString()}] Hecho. ${dryRun ? "A restaurar" : "Restauradas"}: ${restored}, omitidas: ${skipped}.`);
    if (dryRun) console.log("DRY-RUN: no se escribio nada. Quita --dry-run para aplicar.");
  } catch (err) {
    console.error("Error en restore-eliminated-affiliates:", err.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  run();
}

module.exports = { stripDelPrefix, delTimestamp, isRestorable, buildRestorePatch, orderSponsorsFirst, resolveActiveSponsor };
