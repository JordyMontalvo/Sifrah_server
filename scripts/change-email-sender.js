#!/usr/bin/env node

/**
 * Script para configurar el email que envía los correos del sistema
 * Uso: node scripts/change-email-sender.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n📧 ============================================');
  console.log('   CONFIGURACIÓN DE EMAIL - SIFRAH');
  console.log('============================================\n');
  
  console.log('Este script te ayudará a configurar el email que envía los correos.\n');
  
  // Verificar si ya existe .env
  const envPath = path.join(__dirname, '..', '.env');
  let existingEnv = '';
  
  if (fs.existsSync(envPath)) {
    console.log('✅ Archivo .env encontrado\n');
    existingEnv = fs.readFileSync(envPath, 'utf8');
  } else {
    console.log('⚠️  No existe archivo .env, se creará uno nuevo\n');
  }
  
  // Obtener información del usuario
  console.log('📝 Ingresa los siguientes datos:\n');
  
  const emailUser = await question('1️⃣  Email que enviará los correos (Gmail): ');
  const emailPass = await question('2️⃣  App Password de Gmail (16 caracteres): ');
  const adminEmail = await question('3️⃣  Email del administrador [opcional]: ') || emailUser;
  const frontendUrl = await question('4️⃣  URL del frontend [http://localhost:8080]: ') || 'http://localhost:8080';
  
  console.log('\n🔍 Verificando datos...\n');
  
  // Validaciones
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailUser)) {
    console.error('❌ Email inválido');
    rl.close();
    process.exit(1);
  }
  
  if (emailPass.length < 8) {
    console.error('❌ App Password muy corto (debe tener al menos 16 caracteres)');
    rl.close();
    process.exit(1);
  }
  
  // Preparar contenido del .env
  let envContent = '';
  
  if (existingEnv) {
    // Actualizar variables existentes
    envContent = existingEnv
      .replace(/EMAIL_USER=.*/g, `EMAIL_USER=${emailUser}`)
      .replace(/EMAIL_PASS=.*/g, `EMAIL_PASS=${emailPass}`)
      .replace(/ADMIN_EMAIL=.*/g, `ADMIN_EMAIL=${adminEmail}`)
      .replace(/FRONTEND_URL=.*/g, `FRONTEND_URL=${frontendUrl}`);
    
    // Si no existían, agregarlas
    if (!envContent.includes('EMAIL_USER=')) {
      envContent += `\nEMAIL_USER=${emailUser}`;
    }
    if (!envContent.includes('EMAIL_PASS=')) {
      envContent += `\nEMAIL_PASS=${emailPass}`;
    }
    if (!envContent.includes('ADMIN_EMAIL=')) {
      envContent += `\nADMIN_EMAIL=${adminEmail}`;
    }
    if (!envContent.includes('FRONTEND_URL=')) {
      envContent += `\nFRONTEND_URL=${frontendUrl}`;
    }
  } else {
    // Crear nuevo .env
    envContent = `# ===================================
# CONFIGURACIÓN DE EMAIL - SIFRAH
# ===================================

EMAIL_USER=${emailUser}
EMAIL_PASS=${emailPass}
ADMIN_EMAIL=${adminEmail}
FRONTEND_URL=${frontendUrl}

# ===================================
# CONFIGURACIÓN DE BASE DE DATOS
# ===================================

MONGODB_URI=mongodb://localhost:27017
DB_URL=mongodb://127.0.0.1:27017/sifrah?directConnection=true

# ===================================
# CONFIGURACIÓN GENERAL
# ===================================

NODE_ENV=development
PORT=3000
`;
  }
  
  // Guardar archivo
  console.log('💾 Guardando configuración...\n');
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ ¡Configuración guardada exitosamente!\n');
  console.log('📋 Resumen de configuración:');
  console.log(`   Email de envío: ${emailUser}`);
  console.log(`   Email admin: ${adminEmail}`);
  console.log(`   Frontend URL: ${frontendUrl}`);
  console.log(`   Archivo: ${envPath}\n`);
  
  // Preguntar si quiere probar
  const test = await question('¿Deseas probar la configuración ahora? (s/n): ');
  
  if (test.toLowerCase() === 's' || test.toLowerCase() === 'si') {
    console.log('\n🧪 Probando configuración...\n');
    rl.close();
    
    // Ejecutar test
    const { spawn } = require('child_process');
    const testProcess = spawn('node', ['scripts/test-email-config.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ ¡Todo configurado correctamente!');
        console.log('   Puedes usar el sistema de emails ahora.');
      } else {
        console.log('\n⚠️  Hubo un error en la prueba.');
        console.log('   Verifica tu App Password de Gmail.');
      }
      process.exit(code);
    });
  } else {
    console.log('\n📝 Para probar la configuración más tarde, ejecuta:');
    console.log('   node scripts/test-email-config.js\n');
    rl.close();
  }
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error:', error.message);
  rl.close();
  process.exit(1);
});



