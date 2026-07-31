require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const db = require("../components/db");

async function main() {
  const docs = await db.Closed.find({});
  if (docs.length > 0) {
    const doc = docs[docs.length - 1]; // last closure
    console.log(`Checking Closed document from ${doc.date}`);
    if (Array.isArray(doc.users) && doc.users.length > 0) {
      console.log("User keys:", Object.keys(doc.users[0]));
      console.log("User sample data:", JSON.stringify(doc.users[0], null, 2));
    } else {
      console.log("users array is empty or not an array.");
    }
  } else {
    console.log("No Closed documents found.");
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
