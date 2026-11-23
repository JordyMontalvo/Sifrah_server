/**
 * Límite de compra por usuario para promociones comerciales por bloques acumulativos.
 * available_quantity = cupo base por cada bloque de condición: afiliación del ciclo
 * o cada bloque completo de puntos de reconsumo que exige la promoción
 * (promotion_required_points, 160 por defecto).
 */

import { getPromotionRequiredPoints, promotionBlocksFor } from "./promotionEligibility.js";

/**
 * Bloques que habilita una promoción. Acepta la elegibilidad base del socio
 * (se calcula con el puntaje de esa promoción) o, por compatibilidad, un número de bloques ya calculado.
 */
function blocksForPromotion(product, eligibilityOrBlocks) {
  if (eligibilityOrBlocks && typeof eligibilityOrBlocks === "object") {
    return promotionBlocksFor(eligibilityOrBlocks, product);
  }
  return { total_blocks: Math.max(0, Number(eligibilityOrBlocks) || 0) };
}

function matchesPeriod(doc, periodKey) {
  if (!periodKey) return true;
  if (doc.period_key) {
    return String(doc.period_key) === String(periodKey);
  }
  // Fallback si no tiene period_key: comprobar mes calendario
  const d = doc.date || doc.approved_at || doc.created_at;
  if (!d) return true;
  const docDate = new Date(d);
  if (isNaN(docDate.getTime())) return true;
  return true;
}

async function countPromotionPurchasedByUser(
  productId,
  userId,
  Activation,
  periodKey = null
) {
  if (!userId) return 0;

  const query = {
    $or: [{ userId }, { user_id: userId }],
    status: { $in: ["pending", "approved"] },
  };
  if (periodKey) {
    query.period_key = periodKey;
  }

  const activations = await Activation.find(query);

  let purchased = 0;
  for (const act of activations || []) {
    for (const item of act.products || []) {
      if (String(item.id) === String(productId)) {
        purchased += Math.max(
          0,
          Number(item.total != null ? item.total : item.qty) || 0
        );
      }
    }
  }
  return purchased;
}

/** @deprecated Usar countPromotionPurchasedByUser */
async function countPromotionSold(productId, Activation, userId, periodKey) {
  return countPromotionPurchasedByUser(productId, userId, Activation, periodKey);
}

function getPromotionRemaining(product, purchasedByUser = 0, totalBlocks = 1) {
  const baseQuota = Math.max(1, Number(product.available_quantity) || 1);
  const blocks = Math.max(0, Number(totalBlocks) || 0);
  const totalAllowed = blocks * baseQuota;
  return Math.max(0, totalAllowed - (Number(purchasedByUser) || 0));
}

function enrichPromotionForStore(product, purchasedByUser = 0, eligibilityOrBlocks = 0) {
  const baseQuota = Math.max(1, Number(product.available_quantity) || 1);
  const blockInfo = blocksForPromotion(product, eligibilityOrBlocks);
  const blocks = Math.max(0, Number(blockInfo.total_blocks) || 0);
  const totalAllowed = blocks * baseQuota;
  const remaining = Math.max(0, totalAllowed - (Number(purchasedByUser) || 0));

  return {
    ...product,
    points: 0,
    available_quantity: baseQuota,
    promotion_required_points: getPromotionRequiredPoints(product),
    promotion_blocks: blocks,
    promotion_points_to_next_block:
      blockInfo.points_to_next_block != null ? blockInfo.points_to_next_block : null,
    promotion_purchased: purchasedByUser,
    promotion_sold: purchasedByUser,
    promotion_total_allowed: totalAllowed,
    promotion_remaining: remaining,
    promotion_stock: remaining,
    is_promotion: true,
  };
}

function isPromotionRecord(product) {
  if (!product) return false;
  return (
    product.is_promotion === true ||
    product.catalog_type === "promotion" ||
    product.type === "Promoción"
  );
}

async function validatePromotionOrder(
  products,
  catalogById,
  Activation,
  userId,
  periodKey = null,
  promotionEligibility = null
) {
  for (const item of products || []) {
    const dbProduct = catalogById.get(String(item.id));
    if (!dbProduct || !isPromotionRecord(dbProduct)) continue;

    const baseQuota = Math.max(1, Number(dbProduct.available_quantity) || 1);
    const requiredPoints = getPromotionRequiredPoints(dbProduct);
    // Bloques con el puntaje de ESTA promoción (afiliación del ciclo + reconsumo acumulado y del pedido)
    const totalBlocks = promotionEligibility
      ? Math.max(0, Number(blocksForPromotion(dbProduct, promotionEligibility).total_blocks) || 0)
      : 0;
    const totalAllowed = totalBlocks * baseQuota;

    const purchased = await countPromotionPurchasedByUser(
      dbProduct.id,
      userId,
      Activation,
      periodKey
    );

    const qty = Math.max(
      1,
      Number(item.total != null ? item.total : item.qty) || 1
    );

    if (totalBlocks === 0 || totalAllowed === 0) {
      return {
        error: `Para adquirir la promoción "${dbProduct.name}" debes haberte afiliado en el periodo actual o alcanzar al menos ${requiredPoints} puntos de reconsumo.`,
      };
    }

    if (purchased + qty > totalAllowed) {
      const remaining = Math.max(0, totalAllowed - purchased);
      if (remaining <= 0) {
        return {
          error: `Ya alcanzaste el límite de ${totalAllowed} unidad(es) para "${dbProduct.name}" con tus cupos actuales. Puedes desbloquear un nuevo cupo sumando ${requiredPoints} puntos adicionales de reconsumo.`,
        };
      }
      return {
        error: `Límite de compra excedido para "${dbProduct.name}". Solo puedes agregar ${remaining} unidad(es) más con tu puntaje proyectado. Suma ${requiredPoints} puntos más de reconsumo para desbloquear otro cupo.`,
      };
    }
  }
  return null;
}

export {
  countPromotionPurchasedByUser,
  countPromotionSold,
  getPromotionRemaining,
  enrichPromotionForStore,
  validatePromotionOrder,
  isPromotionRecord,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    countPromotionPurchasedByUser,
    countPromotionSold,
    getPromotionRemaining,
    enrichPromotionForStore,
    validatePromotionOrder,
    isPromotionRecord,
  };
}
