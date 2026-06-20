/**
 * Límite de compra por usuario para promociones comerciales.
 * available_quantity = máximo de unidades que cada usuario activo puede comprar.
 */

async function countPromotionPurchasedByUser(productId, userId, Activation) {
  if (!userId) return 0;

  const activations = await Activation.find({
    $or: [{ userId }, { user_id: userId }],
    status: { $in: ["pending", "approved"] },
  });

  let purchased = 0;
  for (const act of activations) {
    for (const item of act.products || []) {
      if (String(item.id) === String(productId)) {
        purchased += Math.max(0, Number(item.total) || 0);
      }
    }
  }
  return purchased;
}

/** @deprecated Usar countPromotionPurchasedByUser */
async function countPromotionSold(productId, Activation, userId) {
  return countPromotionPurchasedByUser(productId, userId, Activation);
}

function getPromotionRemaining(product, purchasedByUser) {
  const max = Number(product.available_quantity) || 0;
  if (max <= 0) return null;
  return Math.max(0, max - purchasedByUser);
}

function enrichPromotionForStore(product, purchasedByUser) {
  const remaining = getPromotionRemaining(product, purchasedByUser);
  return {
    ...product,
    points: 0,
    promotion_purchased: purchasedByUser,
    promotion_sold: purchasedByUser,
    promotion_remaining: remaining,
    promotion_stock: remaining,
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

async function validatePromotionOrder(products, catalogById, Activation, userId) {
  for (const item of products || []) {
    const dbProduct = catalogById.get(String(item.id));
    if (!dbProduct || !isPromotionRecord(dbProduct)) continue;

    const max = Number(dbProduct.available_quantity) || 0;
    if (max <= 0) continue;

    const purchased = await countPromotionPurchasedByUser(
      dbProduct.id,
      userId,
      Activation
    );
    const qty = Math.max(1, Number(item.total) || 1);
    if (purchased + qty > max) {
      const remaining = Math.max(0, max - purchased);
      if (remaining <= 0) {
        return {
          error: `Ya alcanzaste el límite de compra para "${dbProduct.name}" (${max} unidad(es) por usuario).`,
        };
      }
      return {
        error: `Límite de compra para "${dbProduct.name}". Puedes comprar ${remaining} unidad(es) más.`,
      };
    }
  }
  return null;
}

module.exports = {
  countPromotionPurchasedByUser,
  countPromotionSold,
  getPromotionRemaining,
  enrichPromotionForStore,
  validatePromotionOrder,
  isPromotionRecord,
};
