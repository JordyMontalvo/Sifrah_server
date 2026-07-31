require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const db = require("../components/db");

function findNodeInHierarchy(nodes, userId) {
  if (!Array.isArray(nodes)) return null;
  for (const node of nodes) {
    if (!node) continue;
    const id = node.user_id || node.userId || node.id;
    if (id === userId) return node;
    const found = findNodeInHierarchy(node.childs, userId);
    if (found) return found;
  }
  return null;
}

function countDescendants(node) {
  if (!node || !Array.isArray(node.childs)) return 0;
  let count = 0;
  for (const child of node.childs) {
    count++;
    count += countDescendants(child);
  }
  return count;
}

async function main() {
  const docs = await db.Closed.find({});
  const testUserId = "d2v8hsi5u1"; // Norma Ramos Fernandez
  
  console.log(`Searching for test user ${testUserId} in ${docs.length} closures...`);
  
  for (const doc of docs) {
    const node = findNodeInHierarchy(doc.users, testUserId);
    if (node) {
      const teamSize = countDescendants(node);
      console.log(`- Date: ${doc.date}, User Found: ${node.name}, Team Size: ${teamSize}`);
    } else {
      console.log(`- Date: ${doc.date}, User not found in hierarchy`);
    }
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
