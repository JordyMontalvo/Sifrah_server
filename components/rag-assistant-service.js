/**
 * Motor RAG y Guardrails para el Asistente de Bienestar de Sifrah
 * Cumple con .agents/rules/common/coding-style.md (inmutabilidad, modularidad, funciones cortas)
 */

import catalogData, { COMBOS as importedCombos } from './ai-catalog.js';

const catalog = catalogData.default || catalogData;
const COMBOS = importedCombos || catalogData.COMBOS || [];

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
 * Detecta si los productos relevantes aplican a un Combo de Sinergia
 * @param {object[]} relevantProducts 
 * @returns {object|null}
 */
function findApplicableCombo(relevantProducts) {
  if (!relevantProducts || relevantProducts.length === 0) return null;
  if (!COMBOS || COMBOS.length === 0) return null;

  const relevantSkus = relevantProducts.map(p => p.sku);

  // Buscar un combo donde el producto principal coincida con el primer recomendado
  const primarySku = relevantSkus[0];
  const foundCombo = COMBOS.find(c => c.primarySku === primarySku);
  if (!foundCombo) return null;

  // Encontrar el producto acompañante en el catálogo
  const companionProduct = catalog.find(p => p.sku === foundCombo.companionSku);
  return {
    ...foundCombo,
    companionProduct
  };
}

/**
 * Construye el prompt de contexto para el LLM incorporando las fichas RAG y Combos
 * @param {string} userQuery
 * @param {object[]} relevantProducts
 * @param {string} distributorCode
 * @param {object|null} applicableCombo
 * @returns {string} Prompt estructurado
 */
function buildSystemPrompt(userQuery, relevantProducts, distributorCode = '', applicableCombo = null) {
  const productsContext = relevantProducts.map(p => `
PRODUCTO: ${p.names.join(' / ')}
Categoría: ${p.category} | Precio: S/ ${p.price} | Puntos MLM: ${p.points} pts
Dolencias afines: ${p.targetAilments.join(', ')}
Beneficios clave: ${p.benefits.join('; ')}
Ingredientes: ${p.ingredients.join(', ')}
Modo de uso recomendado: ${p.usage}
Precauciones / Contraindicaciones: ${p.contraindications.join('; ')}
`).join('\n---\n');

  let comboContext = '';
  if (applicableCombo) {
    comboContext = `\nCOMBO RECOMENDADO DE SINERGIA:\n- Nombre: ${applicableCombo.name}\n- Justificación: ${applicableCombo.description}\n- Valor: ${applicableCombo.discountHint}\n(Menciona este combo como la mejor opción de tratamiento integral si el usuario busca resultados más completos).\n`;
  }

  return `Eres el Asistente Virtual de Bienestar de Sifrah, una empresa de suplementos y nutrición de venta directa / multinivel.
Tu misión es orientar con empatía a clientes y distribuidores que consultan por dolencias cotidianas, recomendando los productos Sifrah adecuados según la información técnica provista.

DIRECTIVAS CRÍTICAS:
1. TONO: Cálido, empático, profesional y enfocado en bienestar y hábitos saludables.
2. ÉTICA MÉDICA: NO eres médico ni emites diagnósticos definitivos. Habla de "apoyo nutricional", "suplementación coadyuvante" o "fórmulas para el bienestar de...".
3. LIMITACIÓN: Basa tus recomendaciones ÚNICAMENTE en los productos provistos en el CONTEXTO. Si no hay productos afines para lo que pide, indícalo amablemente.
4. ESTRUCTURA DE RESPUESTA:
   - Empatía y comprensión del malestar.
   - Recomendación clara del producto principal con su beneficio puntual y modo de toma.
   - Si hay un COMBO DE SINERGIA disponible, sugiérelo amablemente como la alternativa más potente y completa.
   - Mención de ingredientes activos y precauciones si aplican.
   - Hábitos complementarios sugeridos (agua, sueño, alimentación).
   - Descargo de responsabilidad final breve (los suplementos no curan ni reemplazan consejo médico).

CONTEXTO DE PRODUCTOS DISPONIBLES:
${productsContext || 'No se encontraron productos coincidentes en el catálogo.'}
${comboContext}
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
  const queryLower = (userQuery || '').toLowerCase();

  // 1. Manejo específico para consulta de rango
  if (queryLower.includes('rango') || queryLower.includes('calificar') || queryLower.includes('puntos')) {
    return {
      reply: `💎 **Plan de Carrera y Rangos Sifrah**\n\n` +
        `Para calificar y avanzar a tu próximo rango en Sifrah, ten en cuenta los siguientes pilares clave:\n\n` +
        `1. **Reconsumo Personal:**\n` +
        `   • Rangos Activo y Bronce: Mínimo **120 puntos** personales.\n` +
        `   • Rangos Plata en adelante: Mínimo **160 puntos** personales.\n\n` +
        `2. **Estructura de Líneas Activas:**\n` +
        `   • **Bronce:** 600 pts totales y 2 líneas activas.\n` +
        `   • **Plata:** 1,500 pts totales y 3 líneas activas.\n` +
        `   • **Oro:** 3,300 pts totales y 3 líneas activas.\n` +
        `   • **Rubí:** 8,000 pts totales y 4 líneas activas.\n` +
        `   • **Esmeralda:** 18,000 pts totales y 4 líneas activas.\n` +
        `   • **Diamante:** 38,000 pts totales y 4 líneas activas.\n\n` +
        `3. **Puntos Válidos (PML y PML-R):** Recuerda que el sistema balancea los puntos de tu línea más fuerte y tus líneas de apoyo para premiar el crecimiento equilibrado.\n\n` +
        `🚀 _Consejo pro:_ Monitorea a tus directos en la sección **Red** y acompáñalos a realizar sus activaciones dentro del ciclo mensual.`,
      recommendedProducts: []
    };
  }

  // 2. Manejo específico para impulsar negocio
  if (queryLower.includes('negocio') || queryLower.includes('impulsar') || queryLower.includes('ventas') || queryLower.includes('crecer')) {
    return {
      reply: `🚀 **Estrategias para Impulsar tu Negocio Sifrah**\n\n` +
        `Aquí tienes 3 acciones inmediatas para acelerar tus resultados este mes:\n\n` +
        `🛍️ **1. Comparte tu Tienda Virtual Compartida:**\n` +
        `Usa tu enlace personalizado de tienda para clientes finales. Ellos compran online y tú recibes las ganancias y los puntos automáticamente a tu cuenta.\n\n` +
        `👥 **2. Duplica con tus Frontales:**\n` +
        `Enfócate en ayudar a tus primeros 2 a 3 socios directos a alcanzar su propio rango Bronce. La duplicación en 3 niveles de profundidad es la base del ingreso residual.\n\n` +
        `📚 **3. Sistema Educativo Continuo:**\n` +
        `Ingresa a **Universidad Sifrah**, escucha los audios de liderazgo y comparte los flyers oficiales generados desde la sección de Herramientas.\n\n` +
        `💡 _"El éxito en redes de mercadeo no es hacer cosas extraordinarias, sino hacer cosas simples de forma constante."_`,
      recommendedProducts: []
    };
  }

  // 3. Manejo para catálogo y productos generales
  if (queryLower.includes('producto') || queryLower.includes('catalogo') || queryLower.includes('conocer mas')) {
    const defaultProducts = catalog.slice(0, 3);
    const refParam = distributorCode ? `?ref=${encodeURIComponent(distributorCode)}` : '';
    const formatted = defaultProducts.map(p => ({
      name: p.names[0],
      category: p.category,
      price: p.price,
      points: p.points,
      buyUrl: `/app/checkout${refParam}`,
      usage: p.usage,
      mainBenefit: p.benefits[0]
    }));

    return {
      reply: `🌿 **Línea de Bienestar y Nutrición Sifrah**\n\n` +
        `Nuestros productos están formulados con ingredientes naturales de alta biodisponibilidad para optimizar tu salud y la de tu familia:\n\n` +
        `• **Nutrición Articular y Antienvejecimiento:** Fórmulas con colágeno hidrolizado, magnesio y antioxidantes.\n` +
        `• **Salud Digestiva e Inmunológica:** Suplementos para el equilibrio gástrico y desintoxicación celular.\n` +
        `• **Energía y Vitalidad:** Mezclas botánicas para el rendimiento físico y mental diario.\n\n` +
        `Cada producto consumido o comercializado suma puntos a tu calificación de rango. ¿Tienes alguna consulta sobre una necesidad o molestia específica?`,
      recommendedProducts: formatted
    };
  }

  if (relevantProducts.length === 0) {
    return {
      reply: `Hola, gracias por consultar con el Asistente Sifrah.\n\nPara tu consulta sobre "${userQuery}", no cuento con un suplemento específico en nuestro catálogo actual que se adapte exactamente a esa necesidad. Te recomendamos consultar con un profesional de la salud o revisar nuestro catálogo general de nutrición y bienestar.\n\n_Nota: Los suplementos nutricionales Sifrah son coadyuvantes del bienestar y no sustituyen tratamientos médicos._`,
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
  findApplicableCombo,
  buildSystemPrompt,
  generateFallbackResponse
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    evaluateMedicalGuardrails,
    retrieveRelevantProducts,
    findApplicableCombo,
    buildSystemPrompt,
    generateFallbackResponse
  };
}
