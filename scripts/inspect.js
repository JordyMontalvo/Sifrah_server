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
  if (docs.length > 0) {
    const doc = docs[0];
    console.log("Closed document fields in Mongoose schema/document:");
    console.log("Keys of doc object:", Object.keys(doc));
    console.log("Keys of doc._doc object:", Object.keys(doc._doc || {}));
    console.log("doc.tree:", doc.tree);
  } else {
    console.log("No Closed documents found.");
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
