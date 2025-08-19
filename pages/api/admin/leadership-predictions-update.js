import MLMPredictionService from '../../../components/mlm-prediction-service-working';
const { applyCORS } = require('../../../middleware-cors');

export default async function handler(req, res) {
  // Aplicar CORS flexible
  applyCORS(req, res);

  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action } = req.body;

    if (action === 'update_batch') {
      // Actualizar predicciones para todos los usuarios
      const updatedCount = await MLMPredictionService.updateBatchPredictions();
      
      res.status(200).json({
        success: true,
        message: `Predicciones actualizadas para ${updatedCount} usuarios`,
        updated_count: updatedCount,
        timestamp: new Date().toISOString()
      });
    } else if (action === 'get_user_prediction') {
      // Obtener predicción para un usuario específico
      const { user_id } = req.body;
      
      if (!user_id) {
        return res.status(400).json({ error: 'user_id es requerido' });
      }

      const prediction = await MLMPredictionService.getUserPrediction(user_id);
      
      if (!prediction) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      res.status(200).json({
        success: true,
        data: prediction
      });
    } else {
      res.status(400).json({ error: 'Acción no válida' });
    }

  } catch (error) {
    console.error('Error en leadership predictions update API:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
} 