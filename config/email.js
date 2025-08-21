// Cargar variables de entorno
require('dotenv').config();

const emailConfig = {
  // Configuración del servidor SMTP
  smtp: {
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  },
  
  // Configuración de emails
  from: process.env.EMAIL_USER || 'noreply@sifrah.com',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@sifrah.com',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
  
  // Configuración de límites
  rateLimit: {
    maxEmailsPerHour: 100,
    maxEmailsPerDay: 1000
  }
};

// Validar configuración
function validateConfig() {
  const required = ['EMAIL_USER', 'EMAIL_PASS'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Variables de entorno faltantes:', missing);
    console.error('   Asegúrate de crear el archivo .env con las credenciales correctas');
    return false;
  }
  
  console.log('✅ Configuración de email válida');
  console.log(`   Usuario: ${process.env.EMAIL_USER}`);
  console.log(`   Admin: ${process.env.ADMIN_EMAIL}`);
  console.log(`   Frontend: ${process.env.FRONTEND_URL}`);
  
  return true;
}

module.exports = {
  emailConfig,
  validateConfig
}; 