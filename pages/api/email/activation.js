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
    const { email, name, lastName, activationCode } = req.body;

    // Validar campos requeridos
    if (!email || !name || !activationCode) {
      return res.status(400).json({ 
        error: 'Email, nombre y código de activación son requeridos' 
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Formato de email inválido' 
      });
    }

    // Enviar email de activación
    const result = await emailService.sendActivationEmail({
      email,
      name,
      lastName: lastName || '',
      activationCode
    });

    res.status(200).json({
      success: true,
      message: 'Email de activación enviado exitosamente',
      messageId: result.messageId
    });

  } catch (error) {
    console.error('Error enviando email de activación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
} 