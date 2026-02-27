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

  // Enviar email de bienvenida de afiliación aprobada (mensaje oficial SIFRAH)
  async sendAffiliationApprovedEmail(userData) {
    if (!this.transporter) {
      throw new Error('Transporter no configurado');
    }

    const { email, name, lastName, dni } = userData;

    const mailOptions = {
      from: `"SIFRAH" <${emailConfig.smtp.auth.user}>`,
      to: email,
      subject: '🌟 ¡Bienvenido(a) oficialmente a la familia SIFRAH! 🌟',
      html: this.getAffiliationApprovedTemplate(name, lastName, dni)
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email de bienvenida SIFRAH enviado a:', email, '| ID:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error enviando email de bienvenida SIFRAH:', error);
      throw error;
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

  // Plantilla oficial de bienvenida por afiliación aprobada
  getAffiliationApprovedTemplate(name, lastName, dni) {
    const dashboardUrl = emailConfig.frontendUrl + '/dashboard';
    const tutorialUrl = 'https://www.youtube.com/playlist?list=PLWYJViqkAe6G0cmbXbTXfDORD0DomWWzY';
    const whatsappUrl = 'https://wa.me/51959141444';
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Bienvenido(a) a la familia SIFRAH!</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
          body { margin: 0; padding: 0; background: #0f0f1a; font-family: 'Inter', Arial, sans-serif; }
          .wrapper { background: #0f0f1a; padding: 40px 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #1a1a2e; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
          .header { background: linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%); padding: 40px 30px; text-align: center; }
          .header .star { font-size: 40px; display: block; margin-bottom: 10px; }
          .header h1 { color: white; margin: 0; font-size: 26px; font-weight: 800; line-height: 1.3; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
          .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 15px; }
          .content { padding: 35px 30px; color: #e2e8f0; }
          .greeting { font-size: 18px; color: #c084fc; font-weight: 700; margin-bottom: 15px; }
          .intro { font-size: 15px; line-height: 1.7; color: #cbd5e1; margin-bottom: 25px; }
          .access-box { background: linear-gradient(135deg, #1e1b4b, #2d1b69); border: 1px solid #7c3aed; border-radius: 12px; padding: 25px; margin: 25px 0; }
          .access-box h3 { color: #c084fc; margin: 0 0 15px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; }
          .access-row { display: flex; align-items: center; margin: 10px 0; font-size: 15px; }
          .access-label { color: #94a3b8; min-width: 110px; font-weight: 600; }
          .access-value { color: #f1f5f9; font-weight: 700; background: rgba(124,58,237,0.2); padding: 4px 12px; border-radius: 6px; font-family: monospace; font-size: 14px; }
          .cta-btn { display: block; background: linear-gradient(135deg, #7c3aed, #a855f7); color: white !important; text-decoration: none; text-align: center; padding: 16px 30px; border-radius: 10px; font-weight: 700; font-size: 16px; margin: 25px 0; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(124,58,237,0.4); }
          .notice-box { background: rgba(168,85,247,0.1); border-left: 4px solid #a855f7; border-radius: 0 8px 8px 0; padding: 15px 20px; margin: 20px 0; }
          .notice-box p { margin: 0; color: #c084fc; font-size: 14px; font-weight: 600; }
          .section-title { color: #a855f7; font-size: 15px; font-weight: 700; margin: 25px 0 12px; display: flex; align-items: center; gap: 8px; }
          .tutorial-link { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px; text-decoration: none; color: #e2e8f0; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.08); }
          .tutorial-link:hover { border-color: #7c3aed; }
          .tutorial-icon { font-size: 28px; }
          .tutorial-text strong { display: block; color: #f1f5f9; font-size: 14px; }
          .tutorial-text span { color: #94a3b8; font-size: 12px; }
          .whatsapp-btn { display: flex; align-items: center; justify-content: center; gap: 10px; background: #25D366; color: white !important; text-decoration: none; padding: 14px 25px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 15px 0; }
          .footer { background: #0f0f1a; padding: 25px 30px; text-align: center; }
          .footer p { color: #475569; font-size: 13px; margin: 5px 0; }
          .footer .brand { color: #7c3aed; font-weight: 700; font-size: 16px; }
          .divider { height: 1px; background: rgba(255,255,255,0.08); margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <span class="star">🌟</span>
              <h1>¡Bienvenido(a) oficialmente a la familia SIFRAH!</h1>
              <p>Hola <strong>${name} ${lastName}</strong>, ¡ya eres parte del sistema! 💜</p>
            </div>
            <div class="content">
              <p class="intro">
                Nos alegra que hayas tomado la decisión de construir tu libertad y formar parte de una comunidad que transforma vidas desde la <strong style="color:#c084fc">salud</strong>, la <strong style="color:#c084fc">educación</strong> y las <strong style="color:#c084fc">finanzas</strong>. 💜
              </p>

              <p class="section-title">🚀 Tu acceso a la plataforma virtual</p>
              <div class="access-box">
                <h3>📌 Credenciales de acceso</h3>
                <div class="access-row">
                  <span class="access-label">🔗 Plataforma:</span>
                  <span class="access-value">${dashboardUrl}</span>
                </div>
                <div class="access-row" style="margin-top:12px;">
                  <span class="access-label">👤 Usuario:</span>
                  <span class="access-value">${dni || 'Tu DNI'}</span>
                </div>
                <div class="access-row" style="margin-top:8px;">
                  <span class="access-label">🔒 Contraseña:</span>
                  <span class="access-value">123456</span>
                </div>
              </div>

              <a href="${dashboardUrl}" class="cta-btn">🚀 Ingresar a mi plataforma</a>

              <div class="notice-box">
                <p>📌 Una vez dentro, ve a la sección <strong>"Perfil"</strong> para personalizar tu contraseña.</p>
              </div>

              <div class="divider"></div>

              <p class="section-title">🎓 Tutoriales de uso de tu oficina virtual</p>
              <p style="color:#94a3b8; font-size:14px; margin-bottom:15px;">Aquí aprenderás paso a paso cómo utilizar tu plataforma:</p>

              <a href="${tutorialUrl}" class="tutorial-link">
                <span class="tutorial-icon">📺</span>
                <div class="tutorial-text">
                  <strong>Ver tutoriales en YouTube</strong>
                  <span>Lista de reproducción oficial SIFRAH</span>
                </div>
              </a>

              <div class="divider"></div>

              <p class="section-title">💬 ¿Necesitas ayuda?</p>
              <a href="${whatsappUrl}" class="whatsapp-btn">
                <span>📱</span> WhatsApp de Soporte: +51 959 141 444
              </a>
            </div>
            <div class="footer">
              <p class="brand">SIFRAH</p>
              <p>Salud · Educación · Finanzas</p>
              <p style="margin-top:10px;">© ${new Date().getFullYear()} SIFRAH Network. Todos los derechos reservados.</p>
            </div>
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