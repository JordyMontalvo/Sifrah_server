// Middleware CORS configurable para múltiples orígenes
const allowedOrigins = [
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8080',
  'http://localhost:3000'
];

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  
  // Verificar si el origen está permitido
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Fallback a localhost:8081 si no hay origen o no está permitido
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (next) next();
}

// Función para aplicar CORS a una respuesta específica
function applyCORS(req, res) {
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

module.exports = {
  corsMiddleware,
  applyCORS
}; 