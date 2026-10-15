import {
  evaluateMedicalGuardrails,
  retrieveRelevantProducts,
  findApplicableCombo,
  buildSystemPrompt,
  generateFallbackResponse
} from '../../../components/rag-assistant-service.js';
import { connectDB } from '../../../components/db-connect.js';

import { applyCORS } from '../../../middleware/middleware-cors';
import { consumir } from '../../../components/rate-limit';
const { getClientIp } = require('../../../components/client-ip');

const _fetch = typeof fetch === 'function' ? fetch : require('node-fetch');

// Cada consulta que llega aqui acaba en una llamada de pago a Gemini. Sin freno,
// una sola persona puede dejarla corriendo y la factura la paga la empresa.
// El limite es holgado para no estorbar a una conversacion normal.
const MAX_CONSULTAS = 60;
const VENTANA_MS = 10 * 60 * 1000;

/**
 * Guarda de forma asíncrona (sin bloquear al usuario) el registro de la conversación en MongoDB
 */
async function logConversation({ query, distributorCode, reply, recommendedProducts, combo, isEmergency }) {
  try {
    const db = await connectDB();
    if (db) {
      await db.collection('assistant_conversations').insertOne({
        query,
        distributorCode: distributorCode || 'DIRECTO',
        reply: reply ? reply.substring(0, 1000) : '',
        recommendedProducts: (recommendedProducts || []).map(p => p.name || p),
        comboId: combo ? combo.id : null,
        comboName: combo ? combo.name : null,
        isEmergency: !!isEmergency,
        createdAt: new Date()
      });
    }
  } catch (err) {
    console.warn('[Assistant Logging Error]:', err.message);
  }
}

export default async function handler(req, res) {
  // Se usa la lista de origenes del proyecto. Antes se respondia con un comodin,
  // que permite llamar a este endpoint desde cualquier web y deja sin efecto, solo
  // aqui, el cierre de origenes que se aplico al resto de la API.
  applyCORS(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Método no permitido. Use POST.' });
  }

  const esperar = consumir(getClientIp(req), { maximo: MAX_CONSULTAS, ventanaMs: VENTANA_MS });
  if (esperar > 0) {
    res.setHeader('Retry-After', String(esperar));
    return res.status(429).json({
      status: false,
      message: 'Has hecho demasiadas consultas seguidas. Espera un momento y vuelve a intentarlo.'
    });
  }

  try {
    const { query, distributorCode, history, userName } = req.body || {};

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
      logConversation({
        query: cleanQuery,
        distributorCode,
        reply: emergencyCheck.message,
        recommendedProducts: [],
        combo: null,
        isEmergency: true
      });

      return res.status(200).json({
        status: true,
        data: emergencyCheck
      });
    }

    // 2. Recuperación RAG de productos relevantes y Combos
    const relevantProducts = retrieveRelevantProducts(cleanQuery, 2);
    const applicableCombo = findApplicableCombo(relevantProducts);

    // Si hay un combo, asegurar que el producto acompañante también esté en los recomendados
    const allRecommended = [...relevantProducts];
    if (applicableCombo && applicableCombo.companionProduct) {
      const alreadyIncluded = allRecommended.some(p => p.sku === applicableCombo.companionProduct.sku);
      if (!alreadyIncluded) {
        allRecommended.push(applicableCombo.companionProduct);
      }
    }

    // 3. Generación con LLM (Gemini si existe GEMINI_API_KEY en env, sino fallback local estructurado)
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (geminiApiKey) {
      try {
        const { history } = req.body || {};
        const modelsToTry = [
          'gemini-3.5-flash-lite',
          'gemini-3.8-flash',
          'gemini-flash-latest'
        ];

        let generatedText = null;

        for (const modelName of modelsToTry) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;

            // Construir payload con historial si está disponible
            const contents = [];
            if (Array.isArray(history) && history.length > 0) {
              history.forEach(h => {
                if (h.text) {
                  contents.push({
                    role: h.role === 'model' ? 'model' : 'user',
                    parts: [{ text: h.text }]
                  });
                }
              });
            }

            // Inyectar el turno actual enriquecido con RAG y Combos
            contents.push({
              role: 'user',
              parts: [{ text: buildSystemPrompt(cleanQuery, relevantProducts, distributorCode, applicableCombo, userName) }]
            });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const geminiPayload = {
              contents,
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 800
              }
            };
            if (userName) {
              geminiPayload.systemInstruction = {
                parts: [{
                  text: `Eres SIFRAH, el asistente virtual oficial de nutrición y bienestar de la empresa Sifrah. Estás hablando con ${userName}. Dirígete a él obligatoriamente por su nombre ("${userName}"). Nunca uses otro nombre ni nombres de usuarios anteriores.`
                }]
              };
            }

            const geminiRes = await _fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify(geminiPayload)
            });

            clearTimeout(timeoutId);

            if (geminiRes.ok) {
              const geminiData = await geminiRes.json();
              generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (generatedText) break; // Éxito con este modelo
            } else {
              const errTxt = await geminiRes.text();
              console.warn(`[Assistant] ${modelName} devolvió status ${geminiRes.status}:`, errTxt.slice(0, 100));
            }
          } catch (modelErr) {
            console.warn(`[Assistant] Error con ${modelName}:`, modelErr.message);
          }
        }

        if (generatedText) {
          const refParam = distributorCode ? `?ref=${encodeURIComponent(distributorCode)}` : '';
          const finalProducts = allRecommended.map(p => ({
            name: p.names[0],
            category: p.category,
            price: p.price,
            points: p.points,
            buyUrl: `/app/checkout${refParam}`,
            usage: p.usage,
            mainBenefit: p.benefits[0]
          }));

          logConversation({
            query: cleanQuery,
            distributorCode,
            reply: generatedText,
            recommendedProducts: finalProducts,
            combo: applicableCombo,
            isEmergency: false
          });

          return res.status(200).json({
            status: true,
            data: {
              reply: generatedText,
              combo: applicableCombo ? {
                id: applicableCombo.id,
                name: applicableCombo.name,
                description: applicableCombo.description,
                discountHint: applicableCombo.discountHint
              } : null,
              recommendedProducts: finalProducts
            }
          });
        }
      } catch (geminiError) {
        console.warn('[Assistant] Fallo general en llamadas a Gemini, usando fallback:', geminiError.message);
      }
    }

    // 4. Si no hay Gemini API Key o falló la conexión externa, emitir la respuesta local de alta calidad
    const fallbackResult = generateFallbackResponse(cleanQuery, allRecommended, distributorCode, userName);
    
    logConversation({
      query: cleanQuery,
      distributorCode,
      reply: fallbackResult.reply,
      recommendedProducts: fallbackResult.recommendedProducts,
      combo: applicableCombo,
      isEmergency: false
    });

    return res.status(200).json({
      status: true,
      data: {
        ...fallbackResult,
        combo: applicableCombo ? {
          id: applicableCombo.id,
          name: applicableCombo.name,
          description: applicableCombo.description,
          discountHint: applicableCombo.discountHint
        } : null
      }
    });

  } catch (error) {
    console.error('[Assistant API Error]:', error);
    // El detalle del fallo queda en el registro del servidor, no se devuelve al
    // cliente: suele describir la estructura interna y orienta a quien sondea.
    return res.status(500).json({
      status: false,
      message: 'Ocurrió un error al procesar la consulta con el asistente.'
    });
  }
}
