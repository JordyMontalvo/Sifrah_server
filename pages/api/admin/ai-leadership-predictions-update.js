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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { action, source = '' } = req.body;
    const isMLM = (source || '').toLowerCase() === 'mlm';

    if (action === 'update_batch') {
      // Actualizar predicciones para todos los usuarios
      const updatedCount = isMLM
        ? await MLMPredictionService.updateBatchPredictions()
        : await MLMAIService.updateBatchAIPredictions();
      
      res.status(200).json({
        success: true,
        message: `Predicciones ${isMLM ? 'MLM' : 'IA'} actualizadas para ${updatedCount} usuarios`,
        updated_count: updatedCount,
        source: isMLM ? 'mlm' : 'ai',
        timestamp: new Date().toISOString()
      });
    } else if (action === 'get_user_prediction') {
      // Obtener predicción para un usuario específico
      const { user_id } = req.body;
      
      if (!user_id) {
        return res.status(400).json({ error: 'user_id es requerido' });
      }

      let prediction;
      if (isMLM) {
        prediction = await MLMPredictionService.getUserPrediction(user_id);
      } else {
        // Flujo IA Python: extraer features, predecir y enriquecer respuesta
        const features = await MLMAIService.extractUserFeatures(user_id);
        if (!features) {
          return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const aiPrediction = await MLMAIService.predictWithAIModel(features);
        const normalizedPrediction = MLMAIService.normalizeProbabilities(aiPrediction);
        const ranking = MLMAIService.calculateAIRanking(features, normalizedPrediction);
        const rankingCategory = MLMAIService.getRankingCategory(ranking);
        const medal = MLMAIService.getMedal(normalizedPrediction, features);
        const leadershipScore = MLMAIService.calculateLeadershipScore(features, normalizedPrediction);

        prediction = {
          ...features,
          ...normalizedPrediction,
          ranking,
          ranking_category: rankingCategory,
          medal,
          leadership_score: leadershipScore,
          created_at: new Date()
        };
      }
      
      if (!prediction) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      res.status(200).json({
        success: true,
        source: isMLM ? 'mlm' : 'ai',
        data: prediction
      });
    } else {
      res.status(400).json({ error: 'Acción no válida' });
    }

  } catch (error) {
    console.error('❌ Error en leadership predictions update API:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}