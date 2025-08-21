// Configuración específica para Heroku
module.exports = {
  // Puerto dinámico de Heroku
  port: process.env.PORT || 3000,
  
  // Host para Heroku (0.0.0.0 permite conexiones externas)
  host: '0.0.0.0',
  
  // Entorno
  nodeEnv: process.env.NODE_ENV || 'production',
  
  // MongoDB
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sifrah',
  
  // CORS - Configuración para producción
  corsOrigin: process.env.CORS_ORIGIN || '*', // En Heroku permitimos todos los orígenes por defecto
  
  // Timeouts para Heroku
  serverTimeout: 30000, // 30 segundos
  requestTimeout: 25000, // 25 segundos
  
  // Logs
  enableLogs: true,
  logLevel: 'info'
}; 