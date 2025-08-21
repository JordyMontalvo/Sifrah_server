const nodemailer = require('nodemailer');
const { emailConfig, validateConfig } = require('../config/email');

class EmailService {
  constructor() {
    this.transporter = null;
    this.init();
  }

  init() {
    try {
      // Validar configuración primero
      if (!validateConfig()) {
        console.error('❌ Configuración de email inválida');
        this.transporter = null;
        return;
      }

      // Configuración del transporter usando la configuración validada
      this.transporter = nodemailer.createTransport(emailConfig.smtp);

      console.log('✅ Transporter configurado correctamente');
      console.log(`   Usuario: ${emailConfig.smtp.auth.user}`);
      console.log(`   Host: ${emailConfig.smtp.host}`);
      console.log(`   Puerto: ${emailConfig.smtp.port}`);
    } catch (error) {
      console.error('❌ Error configurando transporter:', error);
      this.transporter = null;
    }
  }

  // Enviar email de bienvenida
  async sendWelcomeEmail(userData) {
    if (!this.transporter) {
      throw new Error('Transporter no configurado');
    }

    const { email, name, lastName } = userData;
    
    const mailOptions = {
      from: emailConfig.from,
      to: email,
      subject: '¡Bienvenido a Sifrah! 🎉',
      html: this.getWelcomeTemplate(name, lastName)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email de bienvenida enviado:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error enviando email de bienvenida:', error);
      throw error;
    }
  }

  // Enviar email de activación
  async sendActivationEmail(userData) {
    if (!this.transporter) {
      throw new Error('Transporter no configurado');
    }

    const { email, name, lastName, activationCode } = userData;
    
    const mailOptions = {
      from: emailConfig.from,
      to: email,
      subject: 'Activa tu cuenta Sifrah 🔐',
      html: this.getActivationTemplate(name, lastName, activationCode)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email de activación enviado:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error enviando email de activación:', error);
      throw error;
    }
  }

  // Enviar email de recuperación de contraseña
  async sendPasswordResetEmail(userData) {
    if (!this.transporter) {
      throw new Error('Transporter no configurado');
    }

    const { email, name, resetToken } = userData;
    
    const mailOptions = {
      from: emailConfig.from,
      to: email,
      subject: 'Recupera tu contraseña Sifrah 🔑',
      html: this.getPasswordResetTemplate(name, resetToken)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email de recuperación enviado:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error enviando email de recuperación:', error);
      throw error;
    }
  }

  // Enviar email de contacto
  async sendContactEmail(contactData) {
    if (!this.transporter) {
      throw new Error('Transporter no configurado');
    }

    const { name, email, subject, message } = contactData;
    
    const mailOptions = {
      from: emailConfig.from,
      to: emailConfig.adminEmail,
      subject: `Nuevo mensaje de contacto: ${subject}`,
      html: this.getContactTemplate(name, email, subject, message)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email de contacto enviado:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error enviando email de contacto:', error);
      throw error;
    }
  }

  // Enviar email de notificación de comisión
  async sendCommissionNotification(userData, commissionData) {
    if (!this.transporter) {
      throw new Error('Transporter no configurado');
    }

    const { email, name } = userData;
    const { amount, type, date } = commissionData;
    
    const mailOptions = {
      from: emailConfig.from,
      to: email,
      subject: '¡Nueva comisión generada! 💰',
      html: this.getCommissionTemplate(name, amount, type, date)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email de comisión enviado:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error enviando email de comisión:', error);
      throw error;
    }
  }

  // Plantilla de bienvenida
  getWelcomeTemplate(name, lastName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido a Sifrah</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%); padding: 30px; text-align: center; border-radius: 10px; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 30px; background: #f9f9f9; border-radius: 10px; margin-top: 20px; }
          .button { display: inline-block; padding: 12px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ¡Bienvenido a Sifrah!</h1>
          </div>
          <div class="content">
            <h2>Hola ${name} ${lastName},</h2>
            <p>¡Nos complace darte la bienvenida a la familia Sifrah!</p>
            <p>Tu cuenta ha sido creada exitosamente y estás listo para comenzar tu viaje hacia el éxito financiero.</p>
            <p>Con Sifrah podrás:</p>
            <ul>
              <li>✅ Construir tu red de afiliados</li>
              <li>✅ Generar ingresos pasivos</li>
              <li>✅ Acceder a beneficios exclusivos</li>
              <li>✅ Crecer tu negocio MLM</li>
            </ul>
            <a href="${emailConfig.frontendUrl}/dashboard" class="button">Ir al Dashboard</a>
          </div>
          <div class="footer">
            <p>© 2024 Sifrah. Todos los derechos reservados.</p>
            <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Plantilla de activación
  getActivationTemplate(name, lastName, activationCode) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Activa tu cuenta Sifrah</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2196f3 0%, #21cbf3 100%); padding: 30px; text-align: center; border-radius: 10px; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 30px; background: #f9f9f9; border-radius: 10px; margin-top: 20px; }
          .code { background: #e3f2fd; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0; }
          .code h2 { color: #1976d2; margin: 0; font-size: 32px; letter-spacing: 5px; }
          .button { display: inline-block; padding: 12px 30px; background: #2196f3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Activa tu cuenta</h1>
          </div>
          <div class="content">
            <h2>Hola ${name} ${lastName},</h2>
            <p>Para completar tu registro en Sifrah, necesitas activar tu cuenta usando el siguiente código:</p>
            <div class="code">
              <h2>${activationCode}</h2>
            </div>
            <p>Este código es válido por 24 horas. Si no lo usas en ese tiempo, deberás solicitar uno nuevo.</p>
            <a href="${emailConfig.frontendUrl}/activate" class="button">Activar cuenta</a>
          </div>
          <div class="footer">
            <p>© 2024 Sifrah. Todos los derechos reservados.</p>
            <p>Si no solicitaste este código, ignora este email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Plantilla de recuperación de contraseña
  getPasswordResetTemplate(name, resetToken) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recupera tu contraseña Sifrah</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff512f 0%, #f09819 100%); padding: 30px; text-align: center; border-radius: 10px; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 30px; background: #f9f9f9; border-radius: 10px; margin-top: 20px; }
          .token { background: #fff3e0; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0; border: 2px dashed #ff9800; }
          .token h2 { color: #e65100; margin: 0; font-size: 24px; word-break: break-all; }
          .button { display: inline-block; padding: 12px 30px; background: #ff9800; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔑 Recupera tu contraseña</h1>
          </div>
          <div class="content">
            <h2>Hola ${name},</h2>
            <p>Has solicitado restablecer tu contraseña en Sifrah. Usa el siguiente token para crear una nueva contraseña:</p>
            <div class="token">
              <h2>${resetToken}</h2>
            </div>
            <p>Este token es válido por 1 hora. Si no lo usas en ese tiempo, deberás solicitar uno nuevo.</p>
            <a href="${emailConfig.frontendUrl}/reset-password?token=${resetToken}" class="button">Restablecer contraseña</a>
          </div>
          <div class="footer">
            <p>© 2024 Sifrah. Todos los derechos reservados.</p>
            <p>Si no solicitaste este cambio, ignora este email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Plantilla de contacto
  getContactTemplate(name, email, subject, message) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuevo mensaje de contacto</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; border-radius: 10px; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 30px; background: #f9f9f9; border-radius: 10px; margin-top: 20px; }
          .field { margin: 15px 0; }
          .field strong { color: #28a745; }
          .message-box { background: white; padding: 20px; border-radius: 5px; border-left: 4px solid #28a745; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Nuevo mensaje de contacto</h1>
          </div>
          <div class="content">
            <h2>Has recibido un nuevo mensaje de contacto</h2>
            <div class="field">
              <strong>Nombre:</strong> ${name}
            </div>
            <div class="field">
              <strong>Email:</strong> ${email}
            </div>
            <div class="field">
              <strong>Asunto:</strong> ${subject}
            </div>
            <div class="field">
              <strong>Mensaje:</strong>
            </div>
            <div class="message-box">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
          <div class="footer">
            <p>© 2024 Sifrah. Todos los derechos reservados.</p>
            <p>Este mensaje fue enviado desde el formulario de contacto del sitio web.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Plantilla de comisión
  getCommissionTemplate(name, amount, type, date) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Nueva comisión generada!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%); padding: 30px; text-align: center; border-radius: 10px; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 30px; background: #f9f9f9; border-radius: 10px; margin-top: 20px; }
          .commission-box { background: white; padding: 30px; text-align: center; border-radius: 10px; margin: 20px 0; border: 3px solid #f7971e; }
          .commission-amount { font-size: 36px; font-weight: bold; color: #f7971e; margin: 10px 0; }
          .commission-type { font-size: 18px; color: #666; margin: 10px 0; }
          .commission-date { font-size: 14px; color: #999; }
          .button { display: inline-block; padding: 12px 30px; background: #f7971e; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 ¡Nueva comisión generada!</h1>
          </div>
          <div class="content">
            <h2>¡Felicitaciones ${name}!</h2>
            <p>Has generado una nueva comisión en tu cuenta Sifrah.</p>
            <div class="commission-box">
              <div class="commission-amount">$${amount}</div>
              <div class="commission-type">${type}</div>
              <div class="commission-date">${new Date(date).toLocaleDateString('es-ES')}</div>
            </div>
            <p>¡Sigue así! Tu esfuerzo está dando frutos.</p>
            <a href="${emailConfig.frontendUrl}/dashboard" class="button">Ver Dashboard</a>
          </div>
          <div class="footer">
            <p>© 2024 Sifrah. Todos los derechos reservados.</p>
            <p>Gracias por ser parte de nuestra comunidad.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Verificar conexión del servicio
  async verifyConnection() {
    try {
      if (!this.transporter) {
        console.error('Transporter no configurado');
        return false;
      }

      console.log('Verificando conexión del servicio de email...');
      await this.transporter.verify();
      console.log('Servicio de email configurado correctamente');
      return true;
    } catch (error) {
      console.error('Error verificando servicio de email:', error);
      return false;
    }
  }
}

// Exportar la clase para Next.js
module.exports = new EmailService(); 