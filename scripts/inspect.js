require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const db = require("../components/db");

async function main() {
  const docs = await db.Closed.find({});
  console.log(`Found ${docs.length} Closed documents in database.`);
  
  for (const doc of docs) {
    const treeLen = Array.isArray(doc.tree) ? doc.tree.length : (doc.tree ? "Exists but not array" : "Undefined/Null");
    const usersLen = Array.isArray(doc.users) ? doc.users.length : (doc.users ? "Exists but not array" : "Undefined/Null");
    console.log(`- Date: ${doc.date}, ID: ${doc.id}, Users size: ${usersLen}, Tree size: ${treeLen}`);
    
    // Check if doc.tree has anything
    if (Array.isArray(doc.tree) && doc.tree.length > 0) {
      console.log("  Sample tree node:", JSON.stringify(doc.tree[0], null, 2));
    }
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
