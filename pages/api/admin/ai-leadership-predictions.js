import MLMAIService from '../../../components/mlm-ai-service';
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { page = 1, limit = 20, filter = 'all', search = '', source = '' } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: 'Parámetros de paginación inválidos' });
    }

    // Si source=mlm usa el servicio local; por defecto usa el servicio de IA Python
    const isMLM = (source || '').toLowerCase() === 'mlm';
    console.log(`🤖 Obteniendo predicciones (${isMLM ? 'MLM local' : 'IA Python'})...`, {
      page: pageNum,
      limit: limitNum,
      filter,
      search
    });

    const result = isMLM
      ? await MLMPredictionService.getAllPredictions(pageNum, limitNum, filter, search)
      : await MLMAIService.getAllAIPredictions(pageNum, limitNum, filter, search);

    console.log('✅ Predicciones obtenidas:', {
      total: result?.data?.users?.length || result?.users?.length || 0,
      stats: result?.data?.stats || null,
      source: isMLM ? 'mlm' : 'ai'
    });

    res.status(200).json(result);

  } catch (error) {
    console.error('❌ Error obteniendo predicciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}