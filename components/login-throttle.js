// Freno de intentos de inicio de sesión.
//
// Sin él se pueden probar contraseñas sin límite, lo que resulta especialmente
// grave mientras la clave maestra siga abriendo cualquier cuenta: basta con
// insistir sobre un documento de identidad hasta acertar.
//
// El conteo es por cuenta, no por dirección IP. La dirección que llega al
// servidor es la del proxy y el 98% de las sesiones quedan registradas como
// 127.0.0.1, así que un límite por IP trataría a casi todos los usuarios como
// un único cliente y los dejaría fuera a la vez.
//
// Los contadores viven en memoria del proceso. El servidor corre en un solo
// proceso, de modo que basta; si algún día se reparte en varios, cada uno
// llevaría su propia cuenta y el freno sería más laxo, nunca más estricto.

const WINDOW_MS = 15 * 60 * 1000; // ventana en la que se acumulan los fallos
const MAX_FAILURES = 10; // fallos permitidos dentro de la ventana
const BLOCK_MS = 15 * 60 * 1000; // cuánto dura el bloqueo al superarlos
const MAX_KEYS = 5000; // tope para que la memoria no crezca sin control

const attempts = new Map();

function purge(now) {
  for (const [key, entry] of attempts) {
    const expired =
      (!entry.blockedUntil || entry.blockedUntil <= now) &&
      now - entry.first > WINDOW_MS;
    if (expired) attempts.delete(key);
  }
}

// Devuelve los segundos que faltan para poder reintentar, o 0 si no hay bloqueo.
export function getRetryAfter(key) {
  try {
    if (!key) return 0;
    const entry = attempts.get(String(key));
    if (!entry || !entry.blockedUntil) return 0;
    const now = Date.now();
    if (entry.blockedUntil <= now) {
      attempts.delete(String(key));
      return 0;
    }
    return Math.ceil((entry.blockedUntil - now) / 1000);
  } catch (e) {
    return 0; // ante la duda, no se bloquea a nadie
  }
}

export function registerFailure(key) {
  try {
    if (!key) return;
    const id = String(key);
    const now = Date.now();

    if (attempts.size > MAX_KEYS) purge(now);
    if (attempts.size > MAX_KEYS) attempts.clear();

    let entry = attempts.get(id);
    // Se reinicia la cuenta si la ventana anterior ya venció.
    if (!entry || now - entry.first > WINDOW_MS) {
      entry = { count: 0, first: now, blockedUntil: 0 };
    }

    entry.count += 1;
    if (entry.count >= MAX_FAILURES) {
      entry.blockedUntil = now + BLOCK_MS;
      entry.count = 0;
      entry.first = now;
    }
    attempts.set(id, entry);
  } catch (e) {
    // El freno nunca debe impedir que alguien intente entrar.
  }
}

export function clearFailures(key) {
  try {
    if (key) attempts.delete(String(key));
  } catch (e) {
    // sin efecto
  }
}

// Mensaje mostrado al usuario. El frontend enseña este texto tal cual.
export function throttleMessage(seconds) {
  const minutos = Math.max(1, Math.ceil(seconds / 60));
  return `Demasiados intentos fallidos. Vuelve a intentarlo en ${minutos} minuto${minutos === 1 ? "" : "s"}.`;
}
