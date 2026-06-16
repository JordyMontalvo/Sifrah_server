require("dotenv").config();

const db = require("../components/db");
const lib = require("../components/lib");

async function main() {
  const { seedDefaultSavingsCategories } = await import("../lib/savingsCategoryDefaults.js");
  const result = await seedDefaultSavingsCategories(db, lib, { skipExisting: true });
  console.log("Categorías creadas:", result.created);
  console.log("Omitidas (ya existían):", result.skipped);
  console.log("Productos vinculados:", result.linked.length);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
