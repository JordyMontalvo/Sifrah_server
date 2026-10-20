const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env' }); // Adjust if needed

const URL = process.env.DB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "sifrah";

// 6 months in milliseconds
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

/**
 * Decide si una cuenta debe darse de baja por inactividad en el cierre.
 *
 * Reglas de permanencia de codigos:
 * - Una cuenta con compra de afiliacion aprobada (`affiliated === true`) es
 *   PERMANENTE: nunca se elimina por inactividad (punto 2).
 * - Las cuentas sin afiliar mantienen la regla actual (punto 1): se eliminan si
 *   llevan > 6 meses inactivas (ultima sesion) o, si nunca iniciaron sesion, si
 *   fueron creadas hace > 6 meses.
 *
 * Funcion pura (sin IO) para poder testearla.
 *
 * @param {object} user
 * @param {{hasSession: boolean, lastSessionMs: ?number}} sessionInfo
 * @param {number} now  epoch ms
 * @param {number} [sixMonthsMs]
 * @returns {boolean}
 */
function shouldEliminate(user, sessionInfo, now, sixMonthsMs = SIX_MONTHS_MS) {
  if (user.affiliated === true) return false;

  const { hasSession, lastSessionMs } = sessionInfo;
  if (hasSession) {
    return !!(lastSessionMs && now - lastSessionMs > sixMonthsMs);
  }

  const creationDate = user.affiliation_date
    ? new Date(user.affiliation_date).getTime()
    : user.date
      ? new Date(user.date).getTime()
      : null;
  return !!(creationDate && now - creationDate > sixMonthsMs);
}

async function run() {
  console.log(`[${new Date().toISOString()}] Starting session elimination script...`);
  
  const client = new MongoClient(URL, { useUnifiedTopology: true });
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    // 1. Get all users who are NOT eliminated
    const users = await db.collection("users").find({ status: { $ne: "eliminated" } }).toArray();
    console.log(`Found ${users.length} active/blocked users to evaluate.`);

    // 2. Get latest session for each user (cualquier sesión cuenta como actividad)
    const sessionsAgg = await db.collection("sessions").aggregate([
      {
        $group: {
          _id: "$id",
          last_active: { $max: "$last_active" },
          created_at: { $max: "$created_at" },
          session_count: { $sum: 1 },
        },
      },
    ]).toArray();

    const now = Date.now();
    const sessionMap = new Map();
    const hasSessionMap = new Map();
    for (const s of sessionsAgg) {
      hasSessionMap.set(s._id, (s.session_count || 0) > 0);
      const dateStr = s.last_active || s.created_at;
      if (dateStr) {
        sessionMap.set(s._id, new Date(dateStr).getTime());
      } else if (s.session_count > 0) {
        // Sesiones antiguas sin fechas: tratarlas como actividad reciente
        sessionMap.set(s._id, now);
      }
    }

    let eliminatedCount = 0;

    for (const user of users) {
      // Skip users without an ID
      if (!user.id) continue;

      const sessionInfo = {
        hasSession: hasSessionMap.get(user.id) || false,
        lastSessionMs: sessionMap.get(user.id) || null,
      };

      if (shouldEliminate(user, sessionInfo, now)) {
        if (sessionInfo.hasSession) {
          console.log(`User ${user.id} (${user.dni}) inactive for > 6 months. Last session: ${new Date(sessionInfo.lastSessionMs).toISOString()}`);
        } else {
          console.log(`User ${user.id} (${user.dni}) never logged in and was created > 6 months ago.`);
        }
        // --- ELIMINATION LOGIC ---
        // 1. Comprimir árbol (hijos suben a la posición del eliminado, sin huecos)
        const node = await db.collection("tree").findOne({ id: user.id });
        let treeCompression = { previous_parent: null, children_reassigned: 0 };
        if (node) {
          const childIds = (node.childs || []).filter((c) => c != null && c !== "");
          const parentId = node.parent || null;
          treeCompression.previous_parent = parentId;
          treeCompression.children_reassigned = childIds.length;

          if (parentId) {
            const parentNode = await db.collection("tree").findOne({ id: parentId });
            if (parentNode) {
              const parentChilds = parentNode.childs || [];
              const idx = parentChilds.findIndex((c) => String(c) === String(user.id));
              let updatedChilds = parentChilds.filter((c) => String(c) !== String(user.id));
              if (childIds.length > 0) {
                if (idx >= 0) {
                  updatedChilds.splice(idx, 0, ...childIds);
                } else {
                  updatedChilds = updatedChilds.concat(childIds);
                }
              }
              await db.collection("tree").updateOne(
                { id: parentNode.id },
                { $set: { childs: updatedChilds } }
              );
            }
            for (const childId of childIds) {
              await db.collection("tree").updateOne(
                { id: childId },
                { $set: { parent: parentId } }
              );
              await db.collection("users").updateOne(
                { id: String(childId) },
                { $set: { parentId: String(parentId) } }
              );
            }
          } else if (childIds.length > 0) {
            for (const childId of childIds) {
              await db.collection("tree").updateOne(
                { id: childId },
                { $set: { parent: null } }
              );
              await db.collection("users").updateOne(
                { id: String(childId) },
                { $set: { parentId: null } }
              );
            }
          }
          await db.collection("tree").updateOne(
            { id: user.id },
            { $set: { childs: [] } }
          );
        }

        // 2. Modify Credentials
        const ts = Math.floor(Date.now() / 1000);
        const newDni = `del_${ts}_${user.dni}`;
        const newEmail = user.email ? `del_${ts}_${user.email}` : user.email;
        const newPhone = user.phone ? `del_${ts}_${user.phone}` : user.phone;
        const newName = user.name + " (Eliminado)";

        // 3. Update User
        const reason = "Cierre automático: Inactividad de sesión por 6 meses";
        await db.collection("users").updateOne({ id: user.id }, {
          $set: {
            status: "eliminated",
            statusReason: reason,
            eliminated_at: new Date(),
            dni: newDni,
            email: newEmail,
            phone: newPhone,
            name: newName,
          }
        });

        // 4. Clean sessions
        await db.collection("sessions").deleteMany({ id: user.id });

        // 5. Audit Log
        const randId = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
        await db.collection("audit_logs").insertOne({
          id: randId,
          date: new Date(),
          collection_name: "users",
          action: "eliminate",
          target_id: user.id,
          user_id: user.id,
          admin_id: "cron_session_elimination",
          state_before: { status: user.status || "active", parentId: user.parentId },
          state_after:  { 
            status: "eliminated", 
            reason: reason, 
            tree_compression: treeCompression 
          }
        });

        eliminatedCount++;
        console.log(`-> Eliminated user ${user.id} successfully.`);
      }
    }

    console.log(`[${new Date().toISOString()}] Finished session elimination. Total eliminated: ${eliminatedCount}`);

  } catch (err) {
    console.error("Error running session elimination script:", err);
  } finally {
    await client.close();
  }
}

// Solo ejecutar cuando se corre directamente (el cron), no al importarlo en tests.
if (require.main === module) {
  run();
}

module.exports = { shouldEliminate };
