/**
 * Direccion real de quien hace la peticion.
 *
 * La aplicacion esta detras de nginx, asi que la direccion de la conexion es
 * siempre 127.0.0.1. Por eso casi todas las sesiones guardadas quedaban con
 * esa direccion y el panel de sesiones activas no servia para saber desde
 * donde habia entrado nadie.
 *
 * Se prefiere X-Real-IP porque nginx la sobrescribe en cada peticion y no se
 * puede falsificar. X-Forwarded-For queda como alternativa, y de ahi se coge
 * la ultima entrada: es la que anade el proxy mas cercano, mientras que las
 * primeras pueden venir del propio cliente.
 */

function getClientIp(req) {
  if (!req || !req.headers) return null;

  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim()) return real.trim();

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const partes = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (partes.length) return partes[partes.length - 1];
  }

  const directa =
    (req.socket && req.socket.remoteAddress) ||
    (req.connection && req.connection.remoteAddress) ||
    null;

  return directa || null;
}

module.exports = { getClientIp };
