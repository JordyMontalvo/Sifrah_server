/**
 * API Route: /api/app/assistant
 * Endpoint para el Asistente de Bienestar Sifrah con RAG, Guardrails Clínicos y Afiliados MLM
 */

import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  evaluateMedicalGuardrails,
  retrieveRelevantProducts,
  buildSystemPrompt,
  generateFallbackResponse
} = require(path.join(process.cwd(), 'components/rag-assistant-service.js'));

const _fetch = typeof fetch === 'function' ? fetch : require('node-fetch');

export default async function handler(req, res) {
  // Configuración CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Método no permitido. Use POST.' });
  }

  try {
    const { query, distributorCode, history } = req.body || {};

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        status: false,
        message: 'La consulta (query) es requerida y debe ser un texto.'
      });
    }

    const cleanQuery = query.trim();

    // 1. Guardrails de Triage Clínico (Emergencias graves)
    const emergencyCheck = evaluateMedicalGuardrails(cleanQuery);
    if (emergencyCheck) {
      return res.status(200).json({
        status: true,
        data: emergencyCheck
      });
    }

    // 2. Recuperación RAG de productos relevantes
    const relevantProducts = retrieveRelevantProducts(cleanQuery, 2);

    // 3. Generación con LLM (Gemini si existe GEMINI_API_KEY en env, sino fallback local estructurado)
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (geminiApiKey) {
      try {
        const systemPrompt = buildSystemPrompt(cleanQuery, relevantProducts, distributorCode);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

        const geminiRes = await _fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: systemPrompt }]
              }
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 800
            }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (generatedText) {
            const refParam = distributorCode ? `?ref=${encodeURIComponent(distributorCode)}` : '';
            return res.status(200).json({
              status: true,
              data: {
                reply: generatedText,
                recommendedProducts: relevantProducts.map(p => ({
                  name: p.names[0],
                  category: p.category,
                  price: p.price,
                  points: p.points,
                  buyUrl: `/app/checkout${refParam}`,
                  usage: p.usage,
                  mainBenefit: p.benefits[0]
                }))
              }
            });
          }
        }
      } catch (geminiError) {
        console.warn('[Assistant] Fallo llamada a Gemini API, usando fallback:', geminiError.message);
      }
    }

    // 4. Si no hay Gemini API Key o falló la conexión externa, emitir la respuesta local de alta calidad
    const fallbackResult = generateFallbackResponse(cleanQuery, relevantProducts, distributorCode);
    return res.status(200).json({
      status: true,
      data: fallbackResult
    });

  } catch (error) {
    console.error('[Assistant API Error]:', error);
    return res.status(500).json({
      status: false,
      message: 'Ocurrió un error al procesar la consulta con el asistente.',
      error: error.message
    });
  }
}
