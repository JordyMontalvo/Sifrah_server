import db from "./db";

const { User } = db;

// Si un proceso muere despues de tomar el cerrojo y antes de soltarlo, el
// usuario quedaria bloqueado para siempre. Pasado este margen el cerrojo se
// considera abandonado y otra peticion puede quedarselo.
const LOCK_TTL_MS = 30000;

/**
 * Toma el cerrojo de billetera de un usuario.
 *
 * El saldo de Sifrah no vive en un campo: se calcula sumando el historial de
 * transacciones. Eso impide comprobarlo y descontarlo en una sola operacion,
 * asi que dos peticiones simultaneas pueden validar ambas contra el mismo
 * saldo y gastarlo dos veces. Serializando por usuario, la segunda espera su
 * turno y vuelve a calcular el saldo ya actualizado.
 *
 * @returns {Promise<boolean>} true si se obtuvo el cerrojo.
 */
export async function acquireWalletLock(userId) {
  if (!userId) return false;

  const staleBefore = new Date(Date.now() - LOCK_TTL_MS);

  const previous = await User.findOneAndUpdate(
    {
      id: userId,
      $or: [
        { wallet_lock: { $exists: false } },
        { wallet_lock: null },
        { wallet_lock: { $lt: staleBefore } },
      ],
    },
    { $set: { wallet_lock: new Date() } }
  );

  return previous !== null;
}

export async function releaseWalletLock(userId) {
  if (!userId) return;
  await User.findOneAndUpdate({ id: userId }, { $set: { wallet_lock: null } });
}
