import lib from "../components/lib";
import { isPromotionProduct } from "./productCatalog";

export const PROMOTION_REQUIRED_POINTS = 160;

/**
 * Elegibilidad para comprar promociones comerciales:
 * - Afiliación aprobada en el periodo abierto actual, o
 * - Reconsumo acumulado del ciclo (user.points) >= 160, o
 * - Reconsumo acumulado + puntos de productos normales en carrito >= 160
 */
export async function getPromotionEligibility(
  user,
  period,
  Affiliation,
  cartProducts = [],
  catalogById = new Map()
) {
  if (!user || !user.id) {
    return {
      eligible: false,
      affiliated_current_period: false,
      accumulated_points: 0,
      cart_points: 0,
      projected_points: 0,
      required_points: PROMOTION_REQUIRED_POINTS,
    };
  }

  const approvedAffiliations =
    (await Affiliation.find({ userId: user.id, status: "approved" })) || [];

  const affiliatedCurrentPeriod = approvedAffiliations.some((affiliation) =>
    lib.isSameAffiliationPeriod(
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
      const quantity = Math.max(0, Number(item.total) || 0);
      return total + fromItem * quantity;
    }

    if (!product) return total;
    const quantity = Math.max(0, Number(item.total) || 0);
    return total + (Number(product.points) || 0) * quantity;
  }, 0);

  const projectedPoints = accumulatedPoints + cartPoints;

  return {
    eligible:
      affiliatedCurrentPeriod ||
      projectedPoints >= PROMOTION_REQUIRED_POINTS,
    affiliated_current_period: affiliatedCurrentPeriod,
    accumulated_points: accumulatedPoints,
    cart_points: cartPoints,
    projected_points: projectedPoints,
    required_points: PROMOTION_REQUIRED_POINTS,
  };
}
