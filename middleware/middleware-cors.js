// Middleware CORS configurable para múltiples orígenes
const productionFallbacks = [];
if (process.env.NODE_ENV === 'production') {
  if (!process.env.FRONTEND_URL) productionFallbacks.push('https://sifrah.vercel.app');
  if (!process.env.ADMIN_URL) productionFallbacks.push('https://sifrah-admin.vercel.app');
}

const allowedOrigins = [
  // Desarrollo local
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8080',
  'http://localhost:3000',
  
  // Producción - Desde variables de entorno
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.ADMIN_URL ? [process.env.ADMIN_URL] : []),
  ...(process.env.BACKEND_URL ? [process.env.BACKEND_URL] : []),
  
  // Orígenes adicionales desde CORS_ORIGINS (separados por coma)
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()) : []),
  
  // Fallback por rol si falta cada variable (FRONTEND_URL y ADMIN_URL por separado)
  ...productionFallbacks,
];  

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  
  // Siempre permitir el origen de la request si está en la lista permitida
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } 
  // En desarrollo, usar localhost:8081 por defecto si no está en la lista
  else if (process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-file-name, x-dir, sentry-trace, baggage');
  
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
  
  // Siempre permitir el origen de la request si está en la lista permitida
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } 
  // En desarrollo, usar localhost:8081 por defecto si no está en la lista
  else if (process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-file-name, x-dir, sentry-trace, baggage');
}

module.exports = {
  corsMiddleware,
  applyCORS
}; 