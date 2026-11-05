// Tests de la restauracion de afiliados dados de baja por inactividad.
//
// Ejecutar desde server/:
//   node --test scripts/test-restore-eliminated-affiliates.js
//
// Solo funciones puras / con dobles en memoria: no toca Mongo.
import { test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  stripDelPrefix,
  delTimestamp,
  isRestorable,
  buildRestorePatch,
  orderSponsorsFirst,
  resolveActiveSponsor,
} = require("./restore-eliminated-affiliates.js");

const TS_NOV4 = Date.UTC(2026, 10, 4, 11, 47) / 1000; // cierre 2026-11-04
const base = {
  id: "u1",
  status: "eliminated",
  affiliated: true,
  statusReason: "Cierre automático: Inactividad de 6 meses",
  dni: `del_${TS_NOV4}_12345678`,
  email: `del_${TS_NOV4}_ana@mail.com`,
  phone: "",
  name: "Ana (Eliminado)",
  parentId: "p1",
};

test("stripDelPrefix / delTimestamp", () => {
  assert.strictEqual(stripDelPrefix(`del_${TS_NOV4}_0999`), "0999");
  assert.strictEqual(stripDelPrefix("12345678"), "12345678");
  assert.strictEqual(stripDelPrefix(null), null);
  assert.strictEqual(delTimestamp(base.dni), TS_NOV4);
  assert.strictEqual(delTimestamp("12345678"), null);
});

test("isRestorable: solo afiliados eliminados por inactividad en ese cierre", () => {
  assert.strictEqual(isRestorable(base, "2026-11-04"), true);
  assert.strictEqual(isRestorable(base, "2026-10-04"), false, "otro cierre");
  assert.strictEqual(isRestorable({ ...base, affiliated: false }, "2026-11-04"), false, "no afiliado");
  assert.strictEqual(
    isRestorable({ ...base, statusReason: "Cierre automático: Usuario no afiliado" }, "2026-11-04"),
    false,
    "baja por no afiliado (punto 1) se mantiene"
  );
  assert.strictEqual(isRestorable({ ...base, status: "active" }, "2026-11-04"), false, "ya restaurada (idempotente)");
  assert.strictEqual(isRestorable({ ...base, dni: "12345678" }, "2026-11-04"), false, "sin prefijo del_");
});

test("buildRestorePatch recupera credenciales y estado", () => {
  const now = new Date("2026-11-05T13:00:00Z");
  const p = buildRestorePatch(base, now);
  assert.strictEqual(p.status, "active");
  assert.strictEqual(p.dni, "12345678");
  assert.strictEqual(p.email, "ana@mail.com");
  assert.strictEqual(p.phone, "");
  assert.strictEqual(p.name, "Ana");
  assert.strictEqual(p.n_inactives, 0);
  assert.strictEqual(p.reactivated_at, now);
  assert.strictEqual(buildRestorePatch({ ...base, name: "Isaias  (Eliminado)" }, now).name, "Isaias");
});

test("orderSponsorsFirst restaura al patrocinador antes que a su invitado", () => {
  const hijo = { id: "h", parentId: "p" };
  const padre = { id: "p", parentId: "x" };
  const nieto = { id: "n", parentId: "h" };
  const ids = orderSponsorsFirst([nieto, hijo, padre]).map((u) => u.id);
  assert.deepStrictEqual(ids, ["p", "h", "n"]);
});

test("resolveActiveSponsor sube hasta el ancestro activo", async () => {
  const db = {
    a: { id: "a", status: "active", parentId: null },
    b: { id: "b", status: "eliminated", parentId: "a" },
    c: { id: "c", status: "eliminated", parentId: "b" },
  };
  const getUser = async (id) => db[id] || null;
  assert.strictEqual(await resolveActiveSponsor("a", getUser), "a");
  assert.strictEqual(await resolveActiveSponsor("c", getUser), "a");
  assert.strictEqual(await resolveActiveSponsor("c", getUser, new Set(["b"])), "b", "b se restaura en el lote");
  assert.strictEqual(await resolveActiveSponsor("zz", getUser), null);
  assert.strictEqual(await resolveActiveSponsor(null, getUser), null);
});
