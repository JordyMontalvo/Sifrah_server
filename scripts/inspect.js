require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const db = require("../components/db");

async function main() {
  const doc = await db.Closed.findOne({});
  if (!doc) {
    console.log("No Closed documents found.");
    process.exit(0);
  }
  
  console.log("Closed doc date:", doc.date);
  console.log("Sample user node structure in doc.users:");
  if (Array.isArray(doc.users) && doc.users.length > 0) {
    console.log(JSON.stringify(doc.users[0], null, 2));
  } else {
    console.log("No users array or empty.");
  }
  
  console.log("\nSample tree node structure in doc.tree:");
  if (Array.isArray(doc.tree) && doc.tree.length > 0) {
    console.log(JSON.stringify(doc.tree[0], null, 2));
    
    // Let's check some properties of user IDs
    const userNodes = doc.tree.filter(n => n && (n.id || n.userId || n.user_id));
    console.log(`\nFound ${userNodes.length} nodes in tree with IDs.`);
    if (userNodes.length > 0) {
      const node = userNodes[0];
      console.log("Node keys:", Object.keys(node));
      console.log("Node ID type:", typeof node.id, "value:", node.id);
      console.log("Node childs type:", typeof node.childs, "value:", node.childs);
      
      // Let's see if there is any childs that match
      const withChilds = doc.tree.filter(n => n.childs && n.childs.length > 0);
      console.log(`Found ${withChilds.length} nodes with childs.`);
      if (withChilds.length > 0) {
        console.log("Sample node with childs:", JSON.stringify(withChilds[0], null, 2));
      }
    }
  } else {
    console.log("No tree array or empty.");
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
