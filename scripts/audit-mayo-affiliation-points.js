#!/usr/bin/env node
/**
 * Auditoría mayo 2026: usuarios con migración de paquete y puntos mal acumulados.
 * Uso: DB_URL=... node scripts/audit-mayo-affiliation-points.js
 */
const path = require("path");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const uri =
  process.env.DB_URL ||
  process.env.MONGODB_URI ||
  process.env.DB_URL_PROD;
if (!uri) {
  console.error("Define DB_URL o MONGODB_URI");
  process.exit(1);
}

const PERIOD_MAY = "2026-05";
const MAY_START_UTC = new Date("2026-05-01T00:00:00.000Z");
const MAY_END_UTC = new Date("2026-06-01T00:00:00.000Z");
const MAY_START_LIMA = new Date("2026-05-01T05:00:00.000Z");
const MAY_END_LIMA = new Date("2026-06-01T05:00:00.000Z");

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

function sumInPeriod(approved, userId, periodKey, refDate) {
  let total = 0;
  for (const aff of approved) {
    if (aff.userId !== userId || aff.status !== "approved") continue;
    if (!isSameAffiliationPeriod(aff, periodKey, refDate)) continue;
    total += Number(aff.plan?.affiliation_points) || 0;
  }
  return total;
}

function inRange(d, start, end) {
  if (!d) return false;
  const dt = new Date(d);
  return dt >= start && dt < end;
}

function sortDesc(arr) {
  return [...arr].sort(
    (a, b) =>
      new Date(b.approved_at || b.date) - new Date(a.approved_at || a.date)
  );
}

async function main() {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db(process.env.DB_NAME || "sifrah");

  const allAff = await db.collection("affiliations").find({}).toArray();
  const approved = allAff.filter((a) => a.status === "approved");

  const cases = new Map();

  function addCase(key, row) {
    if (!cases.has(key)) cases.set(key, row);
  }

  // --- A) 2+ aprobadas con period_key 2026-05 ---
  const inPeriodMay = approved.filter((a) => a.period_key === PERIOD_MAY);
  const byUserPeriod = {};
  for (const a of inPeriodMay) {
    if (!byUserPeriod[a.userId]) byUserPeriod[a.userId] = [];
    byUserPeriod[a.userId].push(a);
  }
  for (const [userId, arr] of Object.entries(byUserPeriod)) {
    if (arr.length < 2) continue;
    const sorted = sortDesc(arr);
    const latest = sorted[0];
    const expected = sumInPeriod(
      approved,
      userId,
      PERIOD_MAY,
      latest.approved_at || latest.date
    );
    const user = await db.collection("users").findOne({ id: userId });
    const stored = Number(user?.affiliation_points) || 0;
    const lastPts = Number(latest.plan?.affiliation_points) || 0;
    if (stored !== expected) {
      addCase(userId, {
        criterio: "2+ aprobadas periodo 2026-05",
        userId,
        dni: user?.dni,
        name: `${user?.name || ""} ${user?.lastName || ""}`.trim(),
        stored,
        expected,
        lastPts,
        diff: expected - stored,
        tipo:
          stored === lastPts
            ? "solo_ultimo_paquete"
            : stored < expected
              ? "menos_de_lo_debido"
              : "otro",
        plan_usuario: user?.plan,
        affiliations: sorted.map((a) => ({
          id: a.id,
          plan: a.plan?.id,
          pts: a.plan?.affiliation_points,
          approved_at: a.approved_at,
          period_key: a.period_key,
        })),
      });
    }
  }

  // --- B) 2+ aprobadas con approved_at en mayo (UTC) ---
  const mayApprovedUtc = approved.filter((a) =>
    inRange(a.approved_at || a.date, MAY_START_UTC, MAY_END_UTC)
  );
  const byUserMayUtc = {};
  for (const a of mayApprovedUtc) {
    if (!byUserMayUtc[a.userId]) byUserMayUtc[a.userId] = [];
    byUserMayUtc[a.userId].push(a);
  }
  for (const [userId, arr] of Object.entries(byUserMayUtc)) {
    if (arr.length < 2) continue;
    const sorted = sortDesc(arr);
    const latest = sorted[0];
    const expected = sumInPeriod(
      approved,
      userId,
      latest.period_key,
      latest.approved_at || latest.date
    );
    const user = await db.collection("users").findOne({ id: userId });
    const stored = Number(user?.affiliation_points) || 0;
    const lastPts = Number(latest.plan?.affiliation_points) || 0;
    if (stored !== expected) {
      addCase(userId, {
        criterio: "2+ aprobadas en mayo (UTC calendario)",
        userId,
        dni: user?.dni,
        name: `${user?.name || ""} ${user?.lastName || ""}`.trim(),
        stored,
        expected,
        lastPts,
        diff: expected - stored,
        tipo:
          stored === lastPts
            ? "solo_ultimo_paquete"
            : stored < expected
              ? "menos_de_lo_debido"
              : "otro",
        plan_usuario: user?.plan,
        affiliations: sorted.map((a) => ({
          id: a.id,
          plan: a.plan?.id,
          pts: a.plan?.affiliation_points,
          approved_at: a.approved_at,
          period_key: a.period_key,
        })),
      });
    }
  }

  // --- C) 2+ registros en mayo (cualquier status) con al menos 2 aprobadas en ventana periodo ---
  const mayAny = allAff.filter((a) =>
    inRange(a.approved_at || a.date, MAY_START_LIMA, MAY_END_LIMA)
  );
  const byUserMayLima = {};
  for (const a of mayAny) {
    if (!byUserMayLima[a.userId]) byUserMayLima[a.userId] = [];
    byUserMayLima[a.userId].push(a);
  }
  for (const [userId, arr] of Object.entries(byUserMayLima)) {
    const approvedInList = arr.filter((a) => a.status === "approved");
    if (approvedInList.length < 2) continue;
    const sorted = sortDesc(approvedInList);
    const latest = sorted[0];
    const expected = sumInPeriod(
      approved,
      userId,
      latest.period_key,
      latest.approved_at || latest.date
    );
    const user = await db.collection("users").findOne({ id: userId });
    const stored = Number(user?.affiliation_points) || 0;
    const lastPts = Number(latest.plan?.affiliation_points) || 0;
    if (stored !== expected) {
      addCase(userId, {
        criterio: "2+ aprobadas actividad mayo (Lima UTC-5)",
        userId,
        dni: user?.dni,
        name: `${user?.name || ""} ${user?.lastName || ""}`.trim(),
        stored,
        expected,
        lastPts,
        diff: expected - stored,
        tipo:
          stored === lastPts
            ? "solo_ultimo_paquete"
            : stored < expected
              ? "menos_de_lo_debido"
              : "otro",
        plan_usuario: user?.plan,
        todos_mayo: arr.map((a) => ({
          id: a.id,
          status: a.status,
          plan: a.plan?.id,
          pts: a.plan?.affiliation_points,
          approved_at: a.approved_at,
          date: a.date,
          period_key: a.period_key,
        })),
        affiliations: sorted.map((a) => ({
          id: a.id,
          plan: a.plan?.id,
          pts: a.plan?.affiliation_points,
          approved_at: a.approved_at,
          period_key: a.period_key,
        })),
      });
    }
  }

  // --- D) Migración: 2+ aprobadas que suman al periodo del último, aunque una sea fuera de mayo calendario pero period_key 2026-05 ---
  for (const [userId, arr] of Object.entries(byUserPeriod)) {
    if (arr.length < 2) continue;
    const sorted = sortDesc(arr);
    const latest = sorted[0];
    const expected = sumInPeriod(
      approved,
      userId,
      PERIOD_MAY,
      latest.approved_at || latest.date
    );
    const user = await db.collection("users").findOne({ id: userId });
    const stored = Number(user?.affiliation_points) || 0;
    if (stored === expected) continue;
    // already in map
  }

  // --- E) Usuario con 2+ aprobadas en mismo periodo lógico y última aprobación en mayo 2026 ---
  const byUser = {};
  for (const a of approved) {
    if (!byUser[a.userId]) byUser[a.userId] = [];
    byUser[a.userId].push(a);
  }
  for (const [userId, arr] of Object.entries(byUser)) {
    if (arr.length < 2) continue;
    const sorted = sortDesc(arr);
    const latest = sorted[0];
    const lastDate = new Date(latest.approved_at || latest.date);
    const touchesMay =
      inRange(lastDate, MAY_START_LIMA, MAY_END_LIMA) ||
      latest.period_key === PERIOD_MAY ||
      arr.some(
        (a) =>
          a.period_key === PERIOD_MAY ||
          inRange(a.approved_at || a.date, MAY_START_LIMA, MAY_END_LIMA)
      );
    if (!touchesMay) continue;

    const expected = sumInPeriod(
      approved,
      userId,
      latest.period_key,
      latest.approved_at || latest.date
    );
    const affsInSamePeriod = approved.filter(
      (a) =>
        a.userId === userId &&
        isSameAffiliationPeriod(
          a,
          latest.period_key,
          latest.approved_at || latest.date
        )
    );
    if (affsInSamePeriod.length < 2) continue;

    const user = await db.collection("users").findOne({ id: userId });
    const stored = Number(user?.affiliation_points) || 0;
    const lastPts = Number(latest.plan?.affiliation_points) || 0;
    if (stored !== expected && stored < expected) {
      addCase(userId, {
        criterio: "migracion mismo periodo + actividad mayo",
        userId,
        dni: user?.dni,
        name: `${user?.name || ""} ${user?.lastName || ""}`.trim(),
        stored,
        expected,
        lastPts,
        diff: expected - stored,
        tipo:
          stored === lastPts
            ? "solo_ultimo_paquete"
            : "menos_de_lo_debido",
        periodo_ultimo: latest.period_key,
        plan_usuario: user?.plan,
        affiliations: sortDesc(affsInSamePeriod).map((a) => ({
          id: a.id,
          plan: a.plan?.id,
          pts: a.plan?.affiliation_points,
          approved_at: a.approved_at,
          period_key: a.period_key,
        })),
      });
    }
  }

  const list = [...cases.values()].sort((a, b) => b.diff - a.diff);

  console.log("=== AUDITORÍA MAYO 2026 — puntos de afiliación ===\n");
  console.log("Casos con puntos guardados MENORES que la suma del periodo:", list.length);
  console.log("");

  if (!list.length) {
    console.log("No se encontraron discrepancias pendientes con estos criterios.");
    console.log("(Lily ya fue corregida a 1350 si el fix se aplicó antes.)");
  }

  for (const c of list) {
    console.log("---");
    console.log(`${c.dni} | ${c.name}`);
    console.log(`  Criterio: ${c.criterio}`);
    console.log(`  Tipo: ${c.tipo}`);
    console.log(`  Guardado: ${c.stored} | Debería: ${c.expected} | Falta: +${c.diff}`);
    console.log(`  Plan en usuario: ${c.plan_usuario}`);
    console.log(
      "  Afiliaciones:",
      (c.affiliations || [])
        .map((a) => `${a.plan}(${a.pts}pts) ${a.approved_at || ""}`)
        .join(" → ")
    );
    if (c.todos_mayo) {
      const otros = c.todos_mayo.filter((a) => a.status !== "approved");
      if (otros.length)
        console.log(
          "  Otros registros mayo:",
          otros.map((a) => `${a.status}/${a.plan}`).join(", ")
        );
    }
  }

  // Resumen multi-afiliación mayo sin filtrar por error
  console.log("\n=== RESUMEN: usuarios con 2+ aprobadas vinculadas a mayo ===");
  const multiSummary = [];
  for (const [userId, arr] of Object.entries(byUserPeriod)) {
    if (arr.length >= 2) {
      const u = await db.collection("users").findOne({ id: userId });
      multiSummary.push({
        dni: u?.dni,
        name: `${u?.name || ""} ${u?.lastName || ""}`.trim(),
        count: arr.length,
        pts: u?.affiliation_points,
        ok: Number(u?.affiliation_points) === sumInPeriod(approved, userId, PERIOD_MAY, sortDesc(arr)[0].approved_at),
      });
    }
  }
  for (const m of multiSummary) {
    console.log(
      `  ${m.dni} ${m.name}: ${m.count} afils periodo 2026-05, pts=${m.pts}, ${m.ok ? "OK" : "REVISAR"}`
    );
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
