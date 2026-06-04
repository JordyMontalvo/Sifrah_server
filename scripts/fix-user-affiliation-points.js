#!/usr/bin/env node
/**
 * Corrige affiliation_points y cascada total_points para un DNI.
 * Uso: DB_URL=... node scripts/fix-user-affiliation-points.js --dni=73233003 --points=1020 [--apply]
 */
const path = require("path");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function updateTotalPointsCascade(db, userId, cache) {
  const node = await db.collection("tree").findOne({ id: userId });
  if (!node) return;

  const user = await db.collection("users").findOne({ id: userId });
  if (!user) return;

  let childrenTotal = 0;
  if (node.childs && node.childs.length > 0) {
    const childUsers = await db
      .collection("users")
      .find({ id: { $in: node.childs } })
      .toArray();
    childrenTotal = childUsers.reduce(
      (acc, c) => acc + (Number(c.total_points) || 0),
      0
    );
  }

  const total_points =
    (Number(user.points) || 0) +
    (Number(user.affiliation_points) || 0) +
    childrenTotal;

  const prev = cache.get(userId) ?? user.total_points;
  if (prev !== total_points) {
    await db
      .collection("users")
      .updateOne({ id: userId }, { $set: { total_points } });
    cache.set(userId, total_points);
    console.log(`  total_points ${userId}: ${prev} -> ${total_points}`);
  }

  if (node.parent) {
    await updateTotalPointsCascade(db, node.parent, cache);
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  let dni = null;
  let points = null;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--dni=")) dni = arg.split("=")[1];
    if (arg.startsWith("--points=")) points = Number(arg.split("=")[1]);
  }
  if (!dni || !Number.isFinite(points)) {
    console.error("Uso: --dni=... --points=... [--apply]");
    process.exit(1);
  }

  const uri =
    process.env.DB_URL || process.env.MONGODB_URI || process.env.DB_URL_PROD;
  if (!uri) {
    console.error("Define DB_URL");
    process.exit(1);
  }

  const client = new MongoClient(uri, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db(process.env.DB_NAME || "sifrah");

  const user = await db.collection("users").findOne({ dni: String(dni) });
  if (!user) {
    console.error("Usuario no encontrado");
    process.exit(1);
  }

  const stored = Number(user.affiliation_points) || 0;
  const diff = points - stored;

  console.log(apply ? "=== APLICAR ===" : "=== DRY RUN ===");
  console.log(
    `${user.name} ${user.lastName} (${dni}): ${stored} -> ${points} (+${diff})`
  );
  console.log(`total_points actual: ${user.total_points}`);

  if (!apply) {
    console.log("\nAgrega --apply para guardar.");
    await client.close();
    return;
  }

  await db.collection("users").updateOne(
    { id: user.id },
    { $set: { affiliation_points: points } }
  );

  const cache = new Map();
  cache.set(user.id, user.total_points);
  await updateTotalPointsCascade(db, user.id, cache);

  const after = await db.collection("users").findOne({ id: user.id });
  console.log("\nVerificación:", {
    affiliation_points: after.affiliation_points,
    total_points: after.total_points,
  });

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
