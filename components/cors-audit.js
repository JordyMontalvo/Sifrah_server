// Fase 1 del cierre de CORS: observa, no bloquea.
//
// Las rutas que pasan por lib.midd() aceptan hoy cualquier origen. Antes de
// restringirlas necesitamos saber qué dominios llaman de verdad, para no dejar
// fuera a un cliente legítimo que no tengamos fichado. Este módulo anota cada
// origen nuevo y si encajaría en la lista permitida que ya usa applyCORS.
//
// No modifica cabeceras ni respuestas: el comportamiento sigue igual.
const fs = require("fs");
const path = require("path");
const { allowedOrigins } = require("../middleware/middleware-cors");

const LOG_FILE = path.join(process.cwd(), "cors-audit.log");

// Cada origen se anota una sola vez por proceso para no inundar el log.
const seen = new Set();
// Tope para que un cliente que mande orígenes aleatorios no haga crecer la memoria.
const MAX_TRACKED = 500;

function auditOrigin(req) {
  try {
    const origin = req && req.headers && req.headers.origin;
    if (!origin) return;
    if (seen.has(origin)) return;
    if (seen.size >= MAX_TRACKED) return;
    seen.add(origin);

    const allowed = allowedOrigins.includes(origin);
    console.log(`[CORS-AUDIT] ${allowed ? "conocido" : "DESCONOCIDO"} ${origin}`);

    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        origin,
        allowed,
        path: String(req.url || "").split("?")[0],
      }) + "\n";
    fs.appendFile(LOG_FILE, line, () => {});
  } catch (e) {
    // Una auditoría nunca debe tumbar una petición de producción.
  }
}

module.exports = { auditOrigin, allowedOrigins };
