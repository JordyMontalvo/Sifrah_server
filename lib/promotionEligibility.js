import { isPromotionProduct } from "./productCatalog.js";

export const PROMOTION_REQUIRED_POINTS = 160;

/**
 * Determina si una afiliación corresponde al periodo dado o al mes calendario de referencia.
 */
export function isSameAffiliationPeriod(aff, periodKey, refDate = new Date()) {
  if (!aff) return false;
  const affPeriod = aff.period_key;
  const affDateRaw = aff.approved_at || aff.date;
  const affDate = affDateRaw ? new Date(affDateRaw) : null;
  const ref = refDate ? new Date(refDate) : null;

  const sameCalendarMonth =
    ref &&
    affDate &&
    !isNaN(ref.getTime()) &&
    !isNaN(affDate.getTime()) &&
    affDate.getFullYear() === ref.getFullYear() &&
    affDate.getMonth() === ref.getMonth();

  if (periodKey && affPeriod) {
    return affPeriod === periodKey || sameCalendarMonth;
  }
  if (sameCalendarMonth) return true;
  return !periodKey && !affPeriod;
}

/**
 * Calcula bloques de cupos de promoción basados en:
 * 1. Afiliación aprobada en el periodo actual: 1 cupo base independiente.
 * 2. Reconsumo acumulado + proyectado en el carrito: 1 cupo por cada 160 puntos completos.
 * Regla: los puntos de afiliación no se mezclan con los puntos de reconsumo para los bloques de 160.
 */
export function calculatePromotionBlocks({
  affiliatedCurrentPeriod = false,
  accumulatedPoints = 0,
  cartPoints = 0,
  requiredPoints = PROMOTION_REQUIRED_POINTS,
} = {}) {
  const safeAccumulated = Math.max(0, Number(accumulatedPoints) || 0);
  const safeCart = Math.max(0, Number(cartPoints) || 0);
  const projectedPoints = safeAccumulated + safeCart;

  const affiliationBlocks = affiliatedCurrentPeriod ? 1 : 0;
  const reconsumptionBlocks = Math.floor(projectedPoints / requiredPoints);
  const totalBlocks = affiliationBlocks + reconsumptionBlocks;

  const nextBlockPoints = (reconsumptionBlocks + 1) * requiredPoints;
  const pointsToNextBlock = Math.max(0, nextBlockPoints - projectedPoints);

  return {
    eligible: totalBlocks > 0,
    affiliated_current_period: affiliatedCurrentPeriod,
    affiliation_blocks: affiliationBlocks,
    reconsumption_blocks: reconsumptionBlocks,
    total_blocks: totalBlocks,
    accumulated_points: safeAccumulated,
    cart_points: safeCart,
    projected_points: projectedPoints,
    required_points: requiredPoints,
    next_block_points: nextBlockPoints,
    points_to_next_block: pointsToNextBlock,
  };
}

/**
 * Elegibilidad para comprar promociones comerciales:
 * - Afiliación aprobada en el periodo abierto actual (1 cupo base independiente).
 * - Reconsumo acumulado del ciclo (user.points) + carrito (1 cupo por cada bloque de 160 pts).
 */
export async function getPromotionEligibility(
  user,
  period,
  Affiliation,
  cartProducts = [],
  catalogById = new Map()
) {
  if (!user || !user.id) {
    return calculatePromotionBlocks({
      affiliatedCurrentPeriod: false,
      accumulatedPoints: 0,
      cartPoints: 0,
    });
  }

  const approvedAffiliations =
    (await Affiliation.find({ userId: user.id, status: "approved" })) || [];

  const affiliatedCurrentPeriod = approvedAffiliations.some((affiliation) =>
    isSameAffiliationPeriod(
      affiliation,
      period && period.key,
      new Date()
    )
  );

  const accumulatedPoints = Math.max(0, Number(user.points) || 0);

  const cartPoints = (cartProducts || []).reduce((total, item) => {
    const product = catalogById.get(String(item.id));
    if (product && isPromotionProduct(product)) return total;

    // Preferir puntos ya normalizados del item (POST); fallback a catálogo
    const fromItem = Number(item.points);
    if (Number.isFinite(fromItem) && fromItem >= 0) {
      const quantity = Math.max(0, Number(item.total != null ? item.total : item.qty) || 0);
      return total + fromItem * quantity;
    }

    if (!product) return total;
    const quantity = Math.max(0, Number(item.total != null ? item.total : item.qty) || 0);
    return total + (Number(product.points) || 0) * quantity;
  }, 0);

  return calculatePromotionBlocks({
    affiliatedCurrentPeriod,
    accumulatedPoints,
    cartPoints,
    requiredPoints: PROMOTION_REQUIRED_POINTS,
  });
}
