// Test del contrato de propiedad del cerrojo de billetera.
//
// Ejecutar desde server/:
//   node --test --experimental-test-module-mocks scripts/test-wallet-lock.js
//
// No toca Mongo: mockea el modulo de DB con un User en memoria cuyo
// findOneAndUpdate soporta solo los operadores que usa wallet-lock.js.
import { test, mock } from "node:test";
import assert from "node:assert";

const USER_ID = "u1";

// Documento de usuario en memoria (uno solo, basta para el escenario).
let userDoc;

function matches(filter) {
  if (filter.id !== USER_ID) return false;

  if (filter.$or) {
    const ok = filter.$or.some((cond) => {
      if ("wallet_lock" in cond) {
        const wl = cond.wallet_lock;
        if (wl && wl.$exists === false) return userDoc.wallet_lock === undefined;
        if (wl === null) return userDoc.wallet_lock === null;
      }
      if ("wallet_lock.at" in cond) {
        const at = userDoc.wallet_lock && userDoc.wallet_lock.at;
        const lt = cond["wallet_lock.at"].$lt;
        return at instanceof Date && at < lt;
      }
      return false;
    });
    if (!ok) return false;
  }

  if ("wallet_lock.token" in filter) {
    const token = userDoc.wallet_lock && userDoc.wallet_lock.token;
    if (token !== filter["wallet_lock.token"]) return false;
  }

  return true;
}

const fakeUser = {
  async findOneAndUpdate(filter, update) {
    if (!matches(filter)) return null;
    const previous = { ...userDoc };
    if (update.$set && "wallet_lock" in update.$set) {
      userDoc.wallet_lock = update.$set.wallet_lock;
    }
    return previous;
  },
};

// Mockear ./db.js ANTES de importar wallet-lock, para interceptar la carga del
// db.js real (que conectaria a Mongo) y devolver un User en memoria.
// db exporta default { User }.
mock.module("../components/db.js", {
  defaultExport: { User: fakeUser },
});

const { acquireWalletLock, releaseWalletLock } = await import(
  "../components/wallet-lock.js"
);

test("adquiere cuando no hay cerrojo y devuelve un token", async () => {
  userDoc = { id: USER_ID }; // sin wallet_lock
  const token = await acquireWalletLock(USER_ID);
  assert.strictEqual(typeof token, "string");
  assert.ok(token.length > 0);
});

test("una segunda adquisicion con cerrojo fresco devuelve null", async () => {
  userDoc = { id: USER_ID, wallet_lock: { at: new Date(), token: "t-fresh" } };
  const token = await acquireWalletLock(USER_ID);
  assert.strictEqual(token, null);
});

test("el dueño viejo (token vencido) no borra el cerrojo del nuevo dueño", async () => {
  // A adquiere.
  userDoc = { id: USER_ID };
  const tokenA = await acquireWalletLock(USER_ID);
  assert.ok(tokenA);

  // Se simula que el cerrojo de A vencio (al > 30s).
  userDoc.wallet_lock.at = new Date(Date.now() - 31000);

  // B reclama el cerrojo vencido y obtiene un token nuevo.
  const tokenB = await acquireWalletLock(USER_ID);
  assert.ok(tokenB);
  assert.notStrictEqual(tokenB, tokenA);
  assert.strictEqual(userDoc.wallet_lock.token, tokenB);

  // A termina y libera con su token viejo: NO debe borrar el cerrojo de B.
  await releaseWalletLock(USER_ID, tokenA);
  assert.notStrictEqual(userDoc.wallet_lock, null);
  assert.strictEqual(userDoc.wallet_lock.token, tokenB);

  // B libera con su token: ahora si se borra.
  await releaseWalletLock(USER_ID, tokenB);
  assert.strictEqual(userDoc.wallet_lock, null);
});

test("releaseWalletLock sin token no hace nada", async () => {
  userDoc = { id: USER_ID, wallet_lock: { at: new Date(), token: "t1" } };
  await releaseWalletLock(USER_ID, undefined);
  assert.strictEqual(userDoc.wallet_lock.token, "t1");
});
