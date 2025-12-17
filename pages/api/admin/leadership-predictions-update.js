import MLMPredictionService from '../../../components/mlm-prediction-service-working';
const { applyCORS } = require('../../../middleware/middleware-cors');

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
    // Endpoint DEPRECADO: usa /api/admin/ai-leadership-predictions-update con { source: 'mlm' }
    console.warn('⚠️ Endpoint deprecado: /api/admin/leadership-predictions-update. Usa /api/admin/ai-leadership-predictions-update con { source: \'mlm\' }');

    if (action === 'update_batch') {
      const updatedCount = await MLMPredictionService.updateBatchPredictions();
      return res.status(200).json({
        success: true,
        message: `Predicciones actualizadas para ${updatedCount} usuarios`,
        updated_count: updatedCount,
        timestamp: new Date().toISOString(),
        deprecated: true,
        suggested_endpoint: '/api/admin/ai-leadership-predictions-update',
        suggested_body: { source: 'mlm', action: 'update_batch' }
      });
    } else if (action === 'get_user_prediction') {
      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ error: 'user_id es requerido' });
      }
      const prediction = await MLMPredictionService.getUserPrediction(user_id);
      if (!prediction) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      return res.status(200).json({
        success: true,
        data: prediction,
        deprecated: true,
        suggested_endpoint: '/api/admin/ai-leadership-predictions-update',
        suggested_body: { source: 'mlm', action: 'get_user_prediction', user_id }
      });
    }
    return res.status(400).json({ error: 'Acción no válida' });
  } catch (error) {
    console.error('Error en leadership predictions update API:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}