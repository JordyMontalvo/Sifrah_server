#!/usr/bin/env node
const path = require("path");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const uri = process.env.DB_URL || process.env.MONGODB_URI || process.env.DB_URL_PROD;
const MAY_LIMA_START = new Date("2026-05-01T05:00:00.000Z");
const MAY_LIMA_END = new Date("2026-06-01T05:00:00.000Z");

function inMay(d) {
  if (!d) return false;
  const t = new Date(d);
  return t >= MAY_LIMA_START && t < MAY_LIMA_END;
}

async function main() {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db("sifrah");

  const allAff = await db.collection("affiliations").find({}).toArray();
  const approved = allAff.filter((a) => a.status === "approved");

  console.log("=== 1) Cualquier actividad de afiliación en mayo 2026 ===\n");
  const mayAll = allAff.filter((a) => inMay(a.approved_at || a.date));
  const byUser = {};
  for (const a of mayAll) {
    if (!byUser[a.userId]) byUser[a.userId] = [];
    byUser[a.userId].push(a);
  }

  const multi = Object.entries(byUser).filter(([, a]) => a.length >= 2);
  console.log(`Usuarios con 2+ registros (cualquier estado): ${multi.length}\n`);

  for (const [userId, arr] of multi) {
    const u = await db.collection("users").findOne({ id: userId });
    const approvedMay = arr.filter((x) => x.status === "approved");
    const sumMayPts = approvedMay.reduce(
      (s, x) => s + (Number(x.plan?.affiliation_points) || 0),
      0
    );
    const sorted = [...approvedMay].sort(
      (a, b) => new Date(b.approved_at || b.date) - new Date(a.approved_at || a.date)
    );
    const last = sorted[0];
    const lastPts = last ? Number(last.plan?.affiliation_points) || 0 : 0;
    const stored = Number(u?.affiliation_points) || 0;

    console.log(`${u?.dni} | ${u?.name} ${u?.lastName} | pts usuario: ${stored}`);
    console.log(
      `  Registros: ${arr.map((x) => `${x.status}/${x.plan?.id}/${x.plan?.affiliation_points}pts pk=${x.period_key}`).join(" | ")}`
    );
    console.log(
      `  Suma pts aprobadas en mayo: ${sumMayPts} | Último aprobado: ${lastPts} | Coincide último: ${stored === lastPts} | Coincide suma mayo: ${stored === sumMayPts}`
    );
    console.log("");
  }

  console.log("=== 2) Solo 2+ APROBADAS con fecha aprobación en mayo ===\n");
  const mayAppr = approved.filter((a) => inMay(a.approved_at || a.date));
  const byAppr = {};
  for (const a of mayAppr) {
    if (!byAppr[a.userId]) byAppr[a.userId] = [];
    byAppr[a.userId].push(a);
  }
  for (const [userId, arr] of Object.entries(byAppr)) {
    if (arr.length < 2) continue;
    const u = await db.collection("users").findOne({ id: userId });
    const sum = arr.reduce((s, x) => s + (Number(x.plan?.affiliation_points) || 0), 0);
    const sorted = sortDesc(arr);
    const lastPts = Number(sorted[0].plan?.affiliation_points) || 0;
    const stored = Number(u?.affiliation_points) || 0;
    if (stored !== sum || stored === lastPts) {
      console.log(
        JSON.stringify({
          dni: u?.dni,
          name: `${u?.name} ${u?.lastName}`,
          stored,
          sumMayApproved: sum,
          lastPts,
          problema: stored === lastPts && stored !== sum ? "solo_ultimo" : stored !== sum ? "no_suma" : "ok",
          affs: arr.map((a) => ({
            plan: a.plan?.id,
            pts: a.plan?.affiliation_points,
            period_key: a.period_key,
            approved_at: a.approved_at,
          })),
        })
      );
    }
  }

  console.log("\n=== 3) period_key 2026-05: todos los usuarios (1 o más) con migración ===\n");
  const p05 = approved.filter((a) => a.period_key === "2026-05");
  const byP05 = {};
  for (const a of p05) {
    if (!byP05[a.userId]) byP05[a.userId] = [];
    byP05[a.userId].push(a);
  }
  for (const [userId, arr] of Object.entries(byP05)) {
    if (arr.length < 2) continue;
    const u = await db.collection("users").findOne({ id: userId });
    const sum = arr.reduce((s, x) => s + (Number(x.plan?.affiliation_points) || 0), 0);
    const stored = Number(u?.affiliation_points) || 0;
    console.log(
      `${u?.dni} ${u?.name}: ${arr.length} en 2026-05, stored=${stored}, suma period_key=${sum}, ${stored === sum ? "OK" : "MAL"}`
    );
  }

  console.log("\n=== 4) Activaciones: 2+ aprobadas en mayo ===\n");
  const acts = await db
    .collection("activations")
    .find({ status: "approved" })
    .toArray();
  const mayActs = acts.filter((a) => inMay(a.approved_at || a.date));
  const byAct = {};
  for (const a of mayActs) {
    if (!byAct[a.userId]) byAct[a.userId] = [];
    byAct[a.userId].push(a);
  }
  const multiAct = Object.entries(byAct).filter(([, a]) => a.length >= 2);
  console.log(`Usuarios con 2+ activaciones aprobadas en mayo: ${multiAct.length}`);
  for (const [uid, arr] of multiAct.slice(0, 20)) {
    const u = await db.collection("users").findOne({ id: uid });
    const sumPts = arr.reduce((s, x) => s + (Number(x.points) || 0), 0);
    console.log(
      `  ${u?.dni} ${u?.name}: ${arr.length} acts, user.points=${u?.points}, sum acts=${sumPts}`
    );
  }

  await client.close();
}

function sortDesc(arr) {
  return [...arr].sort(
    (a, b) => new Date(b.approved_at || b.date) - new Date(a.approved_at || a.date)
  );
}

main().catch(console.error);
