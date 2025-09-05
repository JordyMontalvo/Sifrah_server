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
    const { email, name, amount, type, date } = req.body;

    // Validar campos requeridos
    if (!email || !name || !amount || !type) {
      return res.status(400).json({ 
        error: 'Email, nombre, monto y tipo de comisión son requeridos' 
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Formato de email inválido' 
      });
    }

    // Validar que amount sea un número
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ 
        error: 'El monto debe ser un número válido mayor a 0' 
      });
    }

    // Enviar email de notificación de comisión
    const result = await emailService.sendCommissionNotification(
      { email, name },
      { 
        amount: parseFloat(amount), 
        type, 
        date: date || new Date() 
      }
    );

    res.status(200).json({
      success: true,
      message: 'Notificación de comisión enviada exitosamente',
      messageId: result.messageId
    });

  } catch (error) {
    console.error('Error enviando notificación de comisión:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
} 