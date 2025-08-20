import MLMAIService from '../../../components/mlm-ai-service';

export default async function handler(req, res) {
  // Aplicar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    console.log('🤖 Iniciando actualización batch de predicciones de IA...');

    // Actualizar predicciones usando el servicio de IA
    const result = await MLMAIService.updateBatchAIPredictions();

    console.log('✅ Actualización batch de IA completada:', {
      count: result.count,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: 'Predicciones de IA actualizadas exitosamente',
      count: result.count,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error actualizando predicciones de IA:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
} 