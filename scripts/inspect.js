require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const db = require("../components/db");

function calculateClosedTeamSize(userId, usersList) {
  if (!Array.isArray(usersList) || usersList.length === 0) return 0;
  const usersMap = new Map();
  for (const u of usersList) {
    if (u && u.user_id) {
      usersMap.set(u.user_id, u);
    }
  }
  let count = 0;
  const visited = new Set();
  function walk(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const userNode = usersMap.get(id);
    if (!userNode) return;
    const legs = userNode.grouped_points_legs || [];
    for (const leg of legs) {
      if (leg && leg.user_id) {
        count++;
        walk(leg.user_id);
      }
    }
  }
  walk(userId);
  return count;
}

async function main() {
  const docs = await db.Closed.find({});
  const testUserId = "d2v8hsi5u1"; // Norma Ramos Fernandez
  
  console.log(`Testing grouped_points_legs count for test user ${testUserId} in ${docs.length} closures...`);
  
  for (const doc of docs) {
    const teamSize = calculateClosedTeamSize(testUserId, doc.users);
    console.log(`- Date: ${doc.date}, Team Size: ${teamSize}`);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
