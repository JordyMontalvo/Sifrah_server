import MLMAIService from '../../../components/mlm-ai-service';
const { applyCORS } = require('../../../middleware/middleware-cors');

export default async function handler(req, res) {
  // Aplicar CORS
  applyCORS(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    console.log('🔍 Verificando estado del modelo de IA...');

    // Verificar estado del modelo de IA
    const healthStatus = await MLMAIService.checkAIHealth();

    console.log('✅ Estado del modelo de IA:', healthStatus);

    res.status(200).json({
      success: true,
      data: healthStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error verificando estado del modelo de IA:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}