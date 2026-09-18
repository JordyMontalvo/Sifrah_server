const emailService = require('../../../components/email-service');
const { applyCORS } = require('../../../middleware/middleware-cors');
const { requireAdmin } = require('../../../components/adminAuth');
const { consume, throttleMessage } = require('../../../components/send-throttle');

const LIMITE = { max: 20, windowMs: 60 * 60 * 1000 };

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

  // Primitiva de envio: manda el correo a la direccion que le indiquen y
  // ningun flujo de la aplicacion la utiliza. Reservada a administradores.
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const espera = consume(`email:activation:${auth.value}`, LIMITE);
  if (espera) return res.status(429).json({ error: throttleMessage(espera) });

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