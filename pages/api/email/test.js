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
    const { testEmail } = req.body;

    // Si no se proporciona email de prueba, usar uno por defecto
    const email = testEmail || 'test@sifrah.com';

    // Verificar conexión del servicio
    const connectionStatus = await emailService.verifyConnection();

    if (!connectionStatus) {
      return res.status(500).json({
        error: 'No se pudo verificar la conexión del servicio de email',
        connectionStatus: false
      });
    }

    // Enviar email de prueba
    const result = await emailService.sendWelcomeEmail({
      email,
      name: 'Usuario de Prueba',
      lastName: 'Sifrah'
    });

    res.status(200).json({
      success: true,
      message: 'Email de prueba enviado exitosamente',
      messageId: result.messageId,
      connectionStatus: true,
      testEmail: email
    });

  } catch (error) {
    console.error('Error en endpoint de prueba:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
      connectionStatus: false
    });
  }
} 