// Tests de permanencia de codigos y restauracion de cuentas.
//
// Ejecutar desde server/:
//   node --test scripts/test-permanencia-codigos.js
//
// Sin tocar Mongo: shouldEliminate es una funcion pura; reinsertIntoSponsorTree
// se prueba con colecciones Tree/User falsas en memoria.
import { test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { shouldEliminate } = require("./session_elimination.js");
const { reinsertIntoSponsorTree } = require("../lib/treeReinsert.js");

const DAY = 24 * 60 * 60 * 1000;
const SEVEN_MONTHS = 7 * 30 * DAY;
const NOW = Date.now();

// ---------- Punto 1 y 2: shouldEliminate ----------

test("afiliado inactivo NUNCA se elimina (codigo permanente)", () => {
  const user = { id: "a", affiliated: true };
  // con sesion muy vieja
  assert.strictEqual(
    shouldEliminate(user, { hasSession: true, lastSessionMs: NOW - SEVEN_MONTHS }, NOW),
    false
  );
  // sin sesion, creado hace mucho
  assert.strictEqual(
    shouldEliminate({ ...user, date: new Date(NOW - SEVEN_MONTHS) }, { hasSession: false, lastSessionMs: null }, NOW),
    false
  );
});

test("no afiliado con sesion inactiva > 6 meses se elimina", () => {
  const user = { id: "b", affiliated: false };
  assert.strictEqual(
    shouldEliminate(user, { hasSession: true, lastSessionMs: NOW - SEVEN_MONTHS }, NOW),
    true
  );
});

test("no afiliado con sesion reciente NO se elimina", () => {
  const user = { id: "c", affiliated: false };
  assert.strictEqual(
    shouldEliminate(user, { hasSession: true, lastSessionMs: NOW - 5 * DAY }, NOW),
    false
  );
});

test("no afiliado sin sesion, creado hace > 6 meses, se elimina (regla mantenida)", () => {
  const user = { id: "d", affiliated: false, date: new Date(NOW - SEVEN_MONTHS) };
  assert.strictEqual(
    shouldEliminate(user, { hasSession: false, lastSessionMs: null }, NOW),
    true
  );
});

test("no afiliado sin sesion, creado hace poco, NO se elimina", () => {
  const user = { id: "e", affiliated: false, date: new Date(NOW - 10 * DAY) };
  assert.strictEqual(
    shouldEliminate(user, { hasSession: false, lastSessionMs: null }, NOW),
    false
  );
});

// ---------- Punto 3: reinsertIntoSponsorTree ----------

// Colecciones en memoria con la interfaz minima que usa el metodo.
function makeTree(nodes) {
  const store = nodes.map((n) => ({ ...n }));
  return {
    store,
    async findOne(q) {
      return store.find((n) => String(n.id) === String(q.id)) || null;
    },
    async update(q, set) {
      const n = store.find((x) => String(x.id) === String(q.id));
      if (n) Object.assign(n, set);
    },
    async insert(doc) {
      store.push({ ...doc });
    },
  };
}
function makeUsers(users) {
  const store = users.map((u) => ({ ...u }));
  return {
    async findOne(q) {
      return store.find((u) => String(u.id) === String(q.id)) || null;
    },
  };
}

test("restaurar reinserta el nodo como directo de su patrocinador, sin downline antigua", async () => {
  // Patrocinador S con un hijo X (que subio por compresion). El restaurado R
  // fue eliminado: su nodo quedo con childs:[] y fuera de S.childs.
  const Tree = makeTree([
    { id: "S", parent: null, childs: ["X"] },
    { id: "R", parent: "S", childs: [] },
    { id: "X", parent: "S", childs: [] },
  ]);
  const User = makeUsers([{ id: "S" }, { id: "R", parentId: "S" }]);

  const changed = await reinsertIntoSponsorTree(Tree, User, { id: "R", parentId: "S" });

  assert.strictEqual(changed, true);
  const s = await Tree.findOne({ id: "S" });
  assert.ok(s.childs.includes("R"), "R debe colgar de su patrocinador S");
  assert.ok(s.childs.includes("X"), "la red comprimida (X) se mantiene");
  const r = await Tree.findOne({ id: "R" });
  assert.strictEqual(r.parent, "S");
  assert.deepStrictEqual(r.childs, [], "NO se restaura su downline antigua");
});

test("reinsercion es idempotente (no duplica si ya figura)", async () => {
  const Tree = makeTree([
    { id: "S", parent: null, childs: ["R"] },
    { id: "R", parent: "S", childs: [] },
  ]);
  const User = makeUsers([{ id: "S" }, { id: "R", parentId: "S" }]);

  const changed = await reinsertIntoSponsorTree(Tree, User, { id: "R", parentId: "S" });
  assert.strictEqual(changed, false);
  const s = await Tree.findOne({ id: "S" });
  assert.deepStrictEqual(s.childs, ["R"], "no debe duplicarse");
});

test("usa coverage.id del patrocinador si existe", async () => {
  const Tree = makeTree([
    { id: "COV", parent: null, childs: [] },
    { id: "R", parent: null, childs: [] },
  ]);
  const User = makeUsers([
    { id: "S", coverage: { id: "COV" } },
    { id: "R", parentId: "S" },
  ]);

  await reinsertIntoSponsorTree(Tree, User, { id: "R", parentId: "S" });
  const cov = await Tree.findOne({ id: "COV" });
  assert.ok(cov.childs.includes("R"), "debe colgar del nodo de cobertura");
});

test("sin parentId no hace nada", async () => {
  const Tree = makeTree([{ id: "S", parent: null, childs: [] }]);
  const User = makeUsers([{ id: "S" }]);
  const changed = await reinsertIntoSponsorTree(Tree, User, { id: "R" });
  assert.strictEqual(changed, false);
});
