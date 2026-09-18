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

  // Este endpoint envia correos a la direccion que le indiquen. Ningun flujo
  // de la aplicacion lo usa: los correos de bienvenida reales salen del
  // servicio de correo directamente. Queda reservado a administradores.
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const espera = consume(`email:welcome:${auth.value}`, LIMITE);
  if (espera) return res.status(429).json({ error: throttleMessage(espera) });

  try {
    const { email, name, lastName } = req.body;

    // Validar campos requeridos
    if (!email || !name) {
      return res.status(400).json({ 
        error: 'Email y nombre son requeridos' 
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Formato de email inválido' 
      });
    }

    // Enviar email de bienvenida
    const result = await emailService.sendWelcomeEmail({
      email,
      name,
      lastName: lastName || ''
    });

    res.status(200).json({
      success: true,
      message: 'Email de bienvenida enviado exitosamente',
      messageId: result.messageId
    });

  } catch (error) {
    console.error('Error enviando email de bienvenida:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
} 