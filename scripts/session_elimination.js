const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env' }); // Adjust if needed

const URL = process.env.DB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "sifrah";

// 6 months in milliseconds
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

async function run() {
  console.log(`[${new Date().toISOString()}] Starting session elimination script...`);
  
  const client = new MongoClient(URL, { useUnifiedTopology: true });
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    // 1. Get all users who are NOT eliminated
    const users = await db.collection("users").find({ status: { $ne: "eliminated" } }).toArray();
    console.log(`Found ${users.length} active/blocked users to evaluate.`);

    // 2. Get latest session for each user
    const sessionsAgg = await db.collection("sessions").aggregate([
      { 
        $group: { 
          _id: "$id", 
          last_active: { $max: "$last_active" }, 
          created_at: { $max: "$created_at" } 
        } 
      }
    ]).toArray();
    
    const sessionMap = new Map();
    for (const s of sessionsAgg) {
      // Use last_active if available, otherwise fallback to created_at
      const dateStr = s.last_active || s.created_at;
      if (dateStr) {
        sessionMap.set(s._id, new Date(dateStr).getTime());
      }
    }

    const now = Date.now();
    let eliminatedCount = 0;

    for (const user of users) {
      // Skip users without an ID
      if (!user.id) continue;

      let shouldEliminate = false;
      const lastSessionMs = sessionMap.get(user.id);

      if (lastSessionMs) {
        // User has logged in before, check if it's older than 6 months
        if (now - lastSessionMs > SIX_MONTHS_MS) {
          shouldEliminate = true;
          console.log(`User ${user.id} (${user.dni}) inactive for > 6 months. Last session: ${new Date(lastSessionMs).toISOString()}`);
        }
      } else {
        // User has NEVER logged in. Check their creation or affiliation date
        const creationDate = user.affiliation_date ? new Date(user.affiliation_date).getTime() : 
                             user.date ? new Date(user.date).getTime() : null;
        
        if (creationDate && (now - creationDate > SIX_MONTHS_MS)) {
          shouldEliminate = true;
          console.log(`User ${user.id} (${user.dni}) never logged in and was created > 6 months ago.`);
        }
      }

      if (shouldEliminate) {
        // --- ELIMINATION LOGIC ---
        // 1. Compress Tree
        const node = await db.collection("trees").findOne({ id: user.id });
        if (node) {
          const childIds = node.childs || [];
          if (childIds.length > 0 && node.parent) {
            const parentNode = await db.collection("trees").findOne({ id: node.parent });
            if (parentNode) {
              const updatedChilds = parentNode.childs
                .filter(c => String(c) !== String(user.id))
                .concat(childIds);
              await db.collection("trees").updateOne({ id: parentNode.id }, { $set: { childs: updatedChilds } });
            }
            // Update parent for each child
            for (const childId of childIds) {
              await db.collection("trees").updateOne({ id: childId }, { $set: { parent: node.parent } });
              await db.collection("users").updateOne({ id: String(childId) }, { $set: { parentId: String(node.parent) } });
            }
          } else if (childIds.length > 0 && !node.parent) {
            // Root node eliminated
            for (const childId of childIds) {
              await db.collection("trees").updateOne({ id: childId }, { $set: { parent: null } });
              await db.collection("users").updateOne({ id: String(childId) }, { $set: { parentId: null } });
            }
          }
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
            tree_compression: { 
              previous_parent: node ? node.parent : null, 
              children_reassigned: node ? (node.childs || []).length : 0 
            } 
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

run();
