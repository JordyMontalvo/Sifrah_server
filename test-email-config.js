#!/usr/bin/env node

// Script simple para probar la configuración de email
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('🔍 Verificando configuración de email...\n');

// Mostrar variables de entorno
console.log('Variables de entorno:');
console.log(`EMAIL_USER: ${process.env.EMAIL_USER || 'NO DEFINIDA'}`);
console.log(`EMAIL_PASS: ${process.env.EMAIL_PASS ? 'DEFINIDA' : 'NO DEFINIDA'}`);
console.log(`ADMIN_EMAIL: ${process.env.ADMIN_EMAIL || 'NO DEFINIDA'}`);
console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL || 'NO DEFINIDA'}\n`);

// Verificar que las variables requeridas estén definidas
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('❌ Variables EMAIL_USER y EMAIL_PASS son requeridas');
  console.error('   Crea un archivo .env con estas variables');
  process.exit(1);
}

// Crear transporter
console.log('📧 Creando transporter de Nodemailer...');
const transporter = nodemailer.createTransport({
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
});

// Verificar conexión
console.log('🔌 Verificando conexión...');
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error verificando conexión:', error.message);
    
    if (error.code === 'EAUTH') {
      console.error('\n💡 Posibles soluciones:');
      console.error('   1. Verifica que tu email y contraseña sean correctos');
      console.error('   2. Asegúrate de usar una contraseña de aplicación de Gmail');
      console.error('   3. Habilita la verificación en 2 pasos en tu cuenta de Google');
      console.error('   4. Genera una nueva contraseña de aplicación para "Mail"');
    }
    
    process.exit(1);
  } else {
    console.log('✅ Conexión exitosa!');
    console.log('   El servicio de email está configurado correctamente');
    
    // Probar envío de email
    console.log('\n📤 Probando envío de email...');
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: 'Prueba del sistema de email - Sifrah',
      text: 'Este es un email de prueba para verificar que el sistema esté funcionando correctamente.',
      html: `
        <h2>🎉 ¡Sistema de email funcionando!</h2>
        <p>Este es un email de prueba para verificar que el sistema esté funcionando correctamente.</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Servidor:</strong> ${process.env.NODE_ENV || 'development'}</p>
      `
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('❌ Error enviando email de prueba:', error.message);
        process.exit(1);
      } else {
        console.log('✅ Email de prueba enviado exitosamente!');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Enviado a: ${mailOptions.to}`);
        console.log('\n🎯 El sistema de email está completamente funcional');
      }
    });
  }
}); 