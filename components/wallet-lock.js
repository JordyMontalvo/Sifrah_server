import crypto from "crypto";
import db from "./db.js";

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
 * Cada adquisicion graba un token unico junto al cerrojo. Asi, si una peticion
 * tarda mas que el TTL y otra reclama el cerrojo vencido, la primera no puede
 * borrar por error el cerrojo de la segunda al liberar: releaseWalletLock solo
 * actua si el token coincide.
 *
 * @returns {Promise<string|null>} el token del cerrojo, o null si no se obtuvo.
 */
export async function acquireWalletLock(userId) {
  if (!userId) return null;

  const staleBefore = new Date(Date.now() - LOCK_TTL_MS);
  const token = crypto.randomUUID();

  const previous = await User.findOneAndUpdate(
    {
      id: userId,
      $or: [
        { wallet_lock: { $exists: false } },
        { wallet_lock: null },
        { "wallet_lock.at": { $lt: staleBefore } },
      ],
    },
    { $set: { wallet_lock: { at: new Date(), token } } }
  );

  return previous !== null ? token : null;
}

/**
 * Suelta el cerrojo solo si el token coincide con el de quien lo tomo. Si el
 * cerrojo ya fue reclamado por otra peticion (token distinto), no hace nada.
 */
export async function releaseWalletLock(userId, token) {
  if (!userId || !token) return;
  await User.findOneAndUpdate(
    { id: userId, "wallet_lock.token": token },
    { $set: { wallet_lock: null } }
  );
}
