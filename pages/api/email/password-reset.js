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

  // El mas delicado de los seis: envia un correo de recuperacion con el token
  // que le pasen, a la direccion que le pasen. La recuperacion real de los
  // socios no pasa por aqui, sino por /api/auth/forgot-password, que genera el
  // token en el servidor. Reservado a administradores.
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const espera = consume(`email:password-reset:${auth.value}`, LIMITE);
  if (espera) return res.status(429).json({ error: throttleMessage(espera) });

  try {
    const { email, name, resetToken } = req.body;

    // Validar campos requeridos
    if (!email || !name || !resetToken) {
      return res.status(400).json({ 
        error: 'Email, nombre y token de reset son requeridos' 
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Formato de email inválido' 
      });
    }

    // Enviar email de recuperación de contraseña
    const result = await emailService.sendPasswordResetEmail({
      email,
      name,
      resetToken
    });

    res.status(200).json({
      success: true,
      message: 'Email de recuperación enviado exitosamente',
      messageId: result.messageId
    });

  } catch (error) {
    console.error('Error enviando email de recuperación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
} 