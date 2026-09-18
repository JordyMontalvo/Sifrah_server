// Límite de envíos para los endpoints de correo.
//
// A diferencia del freno de inicio de sesión, que cuenta fallos, aquí se
// cuentan envíos correctos: el abuso de un buzón no consiste en equivocarse
// muchas veces, sino en acertar muchas veces seguidas.
//
// El conteo es por sesión, no por dirección IP, por el mismo motivo que en el
// freno de login: la dirección que llega al servidor es la del proxy y casi
// todas las peticiones se verían como un único cliente.
//
// Los contadores viven en memoria del proceso. El servidor corre en uno solo,
// así que basta; si algún día se reparte en varios, cada uno llevaría su
// propia cuenta y el límite sería más laxo, nunca más estricto.

const MAX_KEYS = 5000; // tope para que la memoria no crezca sin control

const buckets = new Map();

function purge(now) {
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Registra un envío y devuelve los segundos que faltan para poder reintentar.
 * Devuelve 0 cuando el envío está permitido.
 */
function consume(key, { max, windowMs }) {
  try {
    if (!key) return 0;
    const id = String(key);
    const now = Date.now();

    if (buckets.size > MAX_KEYS) purge(now);
    if (buckets.size > MAX_KEYS) buckets.clear();

    let entry = buckets.get(id);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
    }

    if (entry.count >= max) {
      buckets.set(id, entry);
      return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    }

    entry.count += 1;
    buckets.set(id, entry);
    return 0;
  } catch (e) {
    return 0; // ante la duda, no se bloquea un envío legítimo
  }
}

function throttleMessage(seconds) {
  const minutos = Math.max(1, Math.ceil(seconds / 60));
  return `Demasiados envíos. Vuelve a intentarlo en ${minutos} minuto${minutos === 1 ? "" : "s"}.`;
}

module.exports = { consume, throttleMessage };
