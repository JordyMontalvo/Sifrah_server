#!/usr/bin/env node
/**
 * Corrige affiliation_points cuando un usuario tiene 2+ afiliaciones aprobadas
 * en el mismo periodo (migración de paquete) y solo quedó el último plan.
 *
 * Uso (desde server/, con DB_URL o MONGODB_URI apuntando a la BD correcta):
 *   node scripts/fix-affiliation-points-period.js
 *   node scripts/fix-affiliation-points-period.js --period=2026-05
 *   node scripts/fix-affiliation-points-period.js --dni=10699647
 *   node scripts/fix-affiliation-points-period.js --apply --period=2026-05
 *   node scripts/fix-affiliation-points-period.js --apply --all
 */

const path = require("path");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function mongoUriAndName() {
  const uri =
    process.env.DB_URL ||
    process.env.MONGODB_URI ||
    process.env.DB_URL_PROD;
  const dbName = process.env.DB_NAME || "sifrah";
  if (!uri) {
    console.error(
      "Define DB_URL o MONGODB_URI (ej. en .env o variable de entorno)."
    );
    process.exit(1);
  }
  return { uri, dbName };
}

function parseArgs() {
  const apply = process.argv.includes("--apply");
  const all = process.argv.includes("--all");
  let period = null;
  let dni = null;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--period=")) period = arg.split("=")[1];
    if (arg.startsWith("--dni=")) dni = arg.split("=")[1];
  }
  return { apply, all, period, dni };
}

function isSameAffiliationPeriod(aff, periodKey, refDate) {
  const affPeriod = aff.period_key;
  const affDateRaw = aff.approved_at || aff.date;
  const affDate = affDateRaw ? new Date(affDateRaw) : null;
  const ref = refDate ? new Date(refDate) : null;
  const sameCalendarMonth =
    ref &&
    affDate &&
    !isNaN(ref.getTime()) &&
    !isNaN(affDate.getTime()) &&
    affDate.getFullYear() === ref.getFullYear() &&
    affDate.getMonth() === ref.getMonth();
  if (periodKey && affPeriod) {
    return affPeriod === periodKey || sameCalendarMonth;
  }
  if (sameCalendarMonth) return true;
  return !periodKey && !affPeriod;
}

function sumApprovedAffiliationPointsInPeriod(
  approved,
  userId,
  periodKey,
  refDate,
  excludeId = null
) {
  let total = 0;
  for (const aff of approved || []) {
    if (aff.userId !== userId) continue;
    if (excludeId && aff.id === excludeId) continue;
    if (!isSameAffiliationPeriod(aff, periodKey, refDate)) continue;
    total += Number(aff.plan?.affiliation_points) || 0;
  }
  return total;
}

function sortAffiliationsByApprovalDesc(affiliations) {
  return [...(affiliations || [])].sort((a, b) => {
    const da = new Date(a.approved_at || a.date || 0).getTime();
    const db = new Date(b.approved_at || b.date || 0).getTime();
    return db - da;
  });
}

function resolveUserAffiliationState(approved, userId, periodKey, refDate) {
  const userAffs = approved.filter(
    (a) => a.userId === userId && a.status === "approved"
  );
  const sorted = sortAffiliationsByApprovalDesc(userAffs);
  const latest = sorted[0];
  if (!latest) return null;

  const pk = periodKey != null ? periodKey : latest.period_key;
  const rd = refDate != null ? refDate : latest.approved_at || latest.date;
  const affiliation_points = sumApprovedAffiliationPointsInPeriod(
    approved,
    userId,
    pk,
    rd
  );

  return {
    affiliated: true,
    _activated: true,
    activated: true,
    plan: latest.plan.id,
    n: latest.plan.n,
    affiliation_points,
    affiliation_date: latest.approved_at || latest.date,
  };
}

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

  const prev = cache.get(userId);
  if (prev !== total_points) {
    await db
      .collection("users")
      .updateOne({ id: userId }, { $set: { total_points } });
    cache.set(userId, total_points);
    console.log(
      `  total_points ${userId}: ${prev ?? user.total_points} -> ${total_points}`
    );
  }

  if (node.parent) {
    await updateTotalPointsCascade(db, node.parent, cache);
  }
}

async function findCandidates(db, approved, { period, dni, all }) {
  const byUser = {};
  for (const a of approved) {
    if (!byUser[a.userId]) byUser[a.userId] = [];
    byUser[a.userId].push(a);
  }

  const fixes = [];
  for (const [userId, arr] of Object.entries(byUser)) {
    if (arr.length < 2) continue;

    const sorted = sortAffiliationsByApprovalDesc(arr);
    const latest = sorted[0];

    if (period && latest.period_key !== period) {
      const inPeriod = arr.filter((a) => a.period_key === period);
      if (inPeriod.length < 2) continue;
    }

    const state = resolveUserAffiliationState(
      approved,
      userId,
      latest.period_key,
      latest.approved_at || latest.date
    );
    if (!state) continue;

    const user = await db.collection("users").findOne({ id: userId });
    if (!user) continue;
    if (dni && String(user.dni) !== String(dni)) continue;

    const stored = Number(user.affiliation_points) || 0;
    if (stored === state.affiliation_points) continue;

    if (!all && stored === 0) continue;

    if (period) {
      const countInPeriod = arr.filter(
        (a) => a.status === "approved" && a.period_key === period
      ).length;
      if (countInPeriod < 2) continue;
    }

    fixes.push({
      userId,
      dni: user.dni,
      name: `${user.name || ""} ${user.lastName || ""}`.trim(),
      stored,
      correct: state.affiliation_points,
      diff: state.affiliation_points - stored,
      period_key: latest.period_key,
      state,
      total_points_before: user.total_points,
    });
  }

  return fixes;
}

async function main() {
  const { apply, all, period, dni } = parseArgs();
  const { uri, dbName } = mongoUriAndName();

  const client = new MongoClient(uri, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db(dbName);

  const approved = await db
    .collection("affiliations")
    .find({ status: "approved" })
    .toArray();

  const fixes = await findCandidates(db, approved, { period, dni, all });

  console.log(apply ? "=== APLICAR CORRECCIONES ===" : "=== DRY RUN ===");
  console.log(
    "Filtros:",
    JSON.stringify({ period: period || "(cualquiera con 2+ afils)", dni, all })
  );
  console.log("Usuarios a corregir:", fixes.length);

  if (!fixes.length) {
    console.log("Nada que corregir.");
    await client.close();
    return;
  }

  for (const f of fixes) {
    console.log(
      `\n${f.dni} | ${f.name}\n  affiliation_points: ${f.stored} -> ${f.correct} (+${f.diff})\n  plan: ${f.state.plan} | periodo: ${f.period_key}`
    );

    if (!apply) continue;

    await db.collection("users").updateOne(
      { id: f.userId },
      { $set: f.state }
    );

    const cache = new Map();
    cache.set(f.userId, f.total_points_before);
    await updateTotalPointsCascade(db, f.userId, cache);
    console.log("  OK: usuario y cascada total_points actualizados");
  }

  if (!apply) {
    console.log("\nEjecuta con --apply para guardar cambios.");
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
