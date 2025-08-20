import MLMAIService from '../../../components/mlm-ai-service';

export default async function handler(req, res) {
  // Aplicar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { page = 1, limit = 20, filter = 'all', search = '' } = req.query;

    console.log('🤖 Obteniendo predicciones de IA...', {
      page: parseInt(page),
      limit: parseInt(limit),
      filter,
      search
    });

    // Obtener predicciones usando el servicio de IA
    const result = await MLMAIService.getAllAIPredictions(
      parseInt(page),
      parseInt(limit),
      filter,
      search
    );

    console.log('✅ Predicciones de IA obtenidas:', {
      total: result.data.users.length,
      stats: result.data.stats
    });

    res.status(200).json(result);

  } catch (error) {
    console.error('❌ Error obteniendo predicciones de IA:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
} 