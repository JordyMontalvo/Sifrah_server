const emailService = require('../../../components/email-service');
const { applyCORS } = require('../../../middleware/middleware-cors');

module.exports = async function handler(req, res) {
  // Aplicar CORS
  applyCORS(req, res);
  
  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { name, email, subject, message } = req.body;

    // Validar campos requeridos
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        error: 'Todos los campos son requeridos' 
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Formato de email inválido' 
      });
    }

    // Enviar email
    const result = await emailService.sendContactEmail({
      name,
      email,
      subject,
      message
    });

    // Enviar confirmación al usuario
    await emailService.sendWelcomeEmail({
      email,
      name,
      lastName: ''
    });

    res.status(200).json({
      success: true,
      message: 'Email enviado exitosamente',
      messageId: result.messageId
    });

  } catch (error) {
    console.error('Error en endpoint de contacto:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
} 