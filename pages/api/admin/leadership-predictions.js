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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { page = 1, limit = 20, filter = 'all', search = '' } = req.query;
    
    // Validar parámetros
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }
    const result = await MLMPredictionService.getAllPredictions(pageNum, limitNum, filter, search);

    // Endpoint DEPRECADO: usa /api/admin/ai-leadership-predictions?source=mlm
    console.warn('⚠️ Endpoint deprecado: /api/admin/leadership-predictions. Usa /api/admin/ai-leadership-predictions?source=mlm');

    res.status(200).json(result);

  } catch (error) {
    console.error('Error en leadership predictions API:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}