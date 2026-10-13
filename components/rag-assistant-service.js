/**
 * Motor RAG y Guardrails para el Asistente de Bienestar de Sifrah
 * Cumple con .agents/rules/common/coding-style.md (inmutabilidad, modularidad, funciones cortas)
 */

import catalogData from './ai-catalog';

const catalog = catalogData.default || catalogData;

// 1. Guardrails de seguridad médica (Triage Clínico de Emergencia)
const EMERGENCY_KEYWORDS = [
  'infarto', 'paro', 'dolor en el pecho', 'opresion en el pecho', 'desmayo', 
  'convulsion', 'hemorragia', 'sangrado abundante', 'dificultad para respirar', 
  'asfixia', 'cancer', 'tumor', 'derrame', 'acv', 'perdida de consciencia',
  'suicid', 'sobredosis', 'intoxicacion grave'
];

/**
 * Evalúa si la consulta del usuario contiene señales de alarma clínica inmediata
 * @param {string} text Consulta del usuario
 * @returns {object|null} Retorna respuesta de emergencia o null si es seguro proceder
 */
function evaluateMedicalGuardrails(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();

  const foundAlert = EMERGENCY_KEYWORDS.some(kw => lower.includes(kw));
  if (foundAlert) {
    return {
      isEmergency: true,
      message: '🚨 ATENCIÓN MÉDICA PRIORITARIA:\n\nLos síntomas descritos sugieren una condición de potencial gravedad. Por favor, acude de inmediato a un centro de salud o servicio de urgencias hospitalarias.\n\n⚠️ En Sifrah promovemos el bienestar y la nutrición, pero nuestros productos son suplementos y no sustituyen la atención médica de emergencia ni tratamientos prescritos.',
      recommendedProducts: []
    };
  }
  return null;
}

/**
 * Normaliza y tokeniza texto para cálculo léxico y semántico
 * @param {string} text 
 * @returns {string[]}
 */
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

/**
 * Recuperador semántico RAG: Busca los productos más relevantes del catálogo según la dolencia/consulta
 * @param {string} query Consulta del usuario
 * @param {number} topK Cantidad de productos a recomendar (default 3)
 * @returns {object[]} Lista ordenada de productos con su score
 */
function retrieveRelevantProducts(query, topK = 3) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scoredProducts = catalog.map(product => {
    let score = 0;
    const matchReasons = [];

    // 1. Coincidencia en dolencias objetivo (peso mayor: 5)
    for (const ailment of product.targetAilments) {
      const ailmentTokens = tokenize(ailment);
      const matches = queryTokens.filter(qt => ailmentTokens.includes(qt));
      if (matches.length > 0) {
        score += matches.length * 5;
        matchReasons.push(`Dolencia: ${ailment}`);
      }
    }

    // 2. Coincidencia en tags / palabras clave (peso: 3)
    for (const tag of product.tags) {
      const tagTokens = tokenize(tag);
      const matches = queryTokens.filter(qt => tagTokens.includes(qt));
      if (matches.length > 0) {
        score += matches.length * 3;
        matchReasons.push(`Tag: ${tag}`);
      }
    }

    // 3. Coincidencia en beneficios (peso: 2)
    for (const benefit of product.benefits) {
      const benefitTokens = tokenize(benefit);
      const matches = queryTokens.filter(qt => benefitTokens.includes(qt));
      if (matches.length > 0) {
        score += matches.length * 2;
      }
    }

    return {
      product,
      score,
      matchReasons: [...new Set(matchReasons)]
    };
  });

  // Filtrar solo productos con coincidencia relevante y ordenar de mayor a menor
  const sorted = scoredProducts
    .filter(item => item.score >= 3)
    .sort((a, b) => b.score - a.score);

  if (sorted.length === 0) return [];
  const maxScore = sorted[0].score;

  // Solo incluir productos con relevancia proporcional al mejor resultado
  return sorted
    .filter(item => item.score >= maxScore * 0.4)
    .slice(0, topK)
    .map(item => item.product);
}

/**
 * Construye el prompt de contexto para el LLM incorporando las fichas RAG
 * @param {string} userQuery
 * @param {object[]} relevantProducts
 * @param {string} distributorCode
 * @returns {string} Prompt estructurado
 */
function buildSystemPrompt(userQuery, relevantProducts, distributorCode = '') {
  const productsContext = relevantProducts.map(p => `
PRODUCTO: ${p.names.join(' / ')}
Categoría: ${p.category} | Precio: S/ ${p.price} | Puntos MLM: ${p.points} pts
Dolencias afines: ${p.targetAilments.join(', ')}
Beneficios clave: ${p.benefits.join('; ')}
Ingredientes: ${p.ingredients.join(', ')}
Modo de uso recomendado: ${p.usage}
Precauciones / Contraindicaciones: ${p.contraindications.join('; ')}
`).join('\n---\n');

  return `Eres el Asistente Virtual de Bienestar de Sifrah, una empresa de suplementos y nutrición de venta directa / multinivel.
Tu misión es orientar con empatía a clientes y distribuidores que consultan por dolencias cotidianas, recomendando los productos Sifrah adecuados según la información técnica provista.

DIRECTIVAS CRÍTICAS:
1. TONO: Cálido, empático, profesional y enfocado en bienestar y hábitos saludables.
2. ÉTICA MÉDICA: NO eres médico ni emites diagnósticos definitivos. Habla de "apoyo nutricional", "suplementación coadyuvante" o "fórmulas para el bienestar de...".
3. LIMITACIÓN: Basa tus recomendaciones ÚNICAMENTE en los productos provistos en el CONTEXTO. Si no hay productos afines para lo que pide, indícalo amablemente.
4. ESTRUCTURA DE RESPUESTA:
   - Empatía y comprensión del malestar.
   - Recomendación clara del producto (o combo de 2 productos) con su beneficio puntual y modo de toma.
   - Mención de ingredientes activos y precauciones si aplican.
   - Hábitos complementarios sugeridos (agua, sueño, alimentación).
   - Descargo de responsabilidad final breve (los suplementos no curan ni reemplazan consejo médico).

CONTEXTO DE PRODUCTOS DISPONIBLES:
${productsContext || 'No se encontraron productos coincidentes en el catálogo.'}

CÓDIGO DE DISTRIBUIDOR DEL USUARIO: ${distributorCode || 'DIRECTO'}

CONSULTA DEL USUARIO:
"${userQuery}"`;
}

/**
 * Generador de respuesta determinista / fallback cuando no hay API Key de LLM configurada
 * Permite que el asistente funcione y pruebe el flujo completo de inmediato.
 * @param {string} userQuery
 * @param {object[]} relevantProducts
 * @param {string} distributorCode
 * @returns {object}
 */
function generateFallbackResponse(userQuery, relevantProducts, distributorCode = '') {
  if (relevantProducts.length === 0) {
    return {
      reply: `Hola, gracias por consultar con el Asistente de Bienestar Sifrah.\n\nPara tu consulta sobre "${userQuery}", no cuento con un suplemento específico en nuestro catálogo actual que se adapte exactamente a esa necesidad. Te recomendamos consultar con un profesional de la salud o revisar nuestro catálogo general de nutrición y cuidado personal.\n\n_Nota: Los suplementos nutricionales Sifrah son coadyuvantes del bienestar y no sustituyen tratamientos médicos._`,
      recommendedProducts: []
    };
  }

  const primary = relevantProducts[0];
  const refParam = distributorCode ? `?ref=${encodeURIComponent(distributorCode)}` : '';

  let replyText = `🌿 **Orientación de Bienestar Sifrah**\n\n`;
  replyText += `Entiendo perfectamente tu consulta respecto a tus molestias. Para apoyar el bienestar en este caso, en Sifrah contamos con una excelente alternativa:\n\n`;

  relevantProducts.forEach((p, idx) => {
    replyText += `**${idx + 1}. ${p.names[0]}** (S/ ${p.price} | ${p.points} Pts)\n`;
    replyText += `• **Beneficio principal:** ${p.benefits[0]}\n`;
    replyText += `• **Ingredientes activos:** ${p.ingredients.slice(0, 3).join(', ')}\n`;
    replyText += `• **Modo de uso sugerido:** ${p.usage}\n`;
    if (p.contraindications.length > 0) {
      replyText += `• *Precaución:* ${p.contraindications[0]}\n`;
    }
    replyText += `\n`;
  });

  replyText += `💧 **Consejo adicional:** Mantén una hidratación constante y hábitos de descanso adecuados.\n\n`;
  replyText += `⚠️ _Descargo de responsabilidad: Los productos Sifrah son suplementos alimenticios formulados para promover un estilo de vida saludable. No son medicamentos ni sustituyen un diagnóstico o tratamiento médico formal._`;

  const formattedProducts = relevantProducts.map(p => ({
    name: p.names[0],
    category: p.category,
    price: p.price,
    points: p.points,
    buyUrl: `/app/checkout${refParam}`,
    usage: p.usage,
    mainBenefit: p.benefits[0]
  }));

  return {
    reply: replyText,
    recommendedProducts: formattedProducts
  };
}

export {
  evaluateMedicalGuardrails,
  retrieveRelevantProducts,
  buildSystemPrompt,
  generateFallbackResponse
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    evaluateMedicalGuardrails,
    retrieveRelevantProducts,
    buildSystemPrompt,
    generateFallbackResponse
  };
}
