/**
 * Control de stock para promociones comerciales.
 */

async function countPromotionSold(productId, Activation) {
  const activations = await Activation.find({
    status: { $in: ["pending", "approved"] },
  });

  let sold = 0;
  for (const act of activations) {
    for (const item of act.products || []) {
      if (String(item.id) === String(productId)) {
        sold += Math.max(0, Number(item.total) || 0);
      }
    }
  }
  return sold;
}

function getPromotionRemaining(product, sold) {
  const max = Number(product.available_quantity) || 0;
  if (max <= 0) return null;
  return Math.max(0, max - sold);
}

function enrichPromotionForStore(product, sold) {
  const remaining = getPromotionRemaining(product, sold);
  return {
    ...product,
    points: 0,
    promotion_sold: sold,
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

async function validatePromotionOrder(products, catalogById, Activation) {
  for (const item of products || []) {
    const dbProduct = catalogById.get(String(item.id));
    if (!dbProduct || !isPromotionRecord(dbProduct)) continue;

    const max = Number(dbProduct.available_quantity) || 0;
    if (max <= 0) continue;

    const sold = await countPromotionSold(dbProduct.id, Activation);
    const qty = Math.max(1, Number(item.total) || 1);
    if (sold + qty > max) {
      const remaining = Math.max(0, max - sold);
      return {
        error: `Stock insuficiente para "${dbProduct.name}". Disponible: ${remaining}.`,
      };
    }
  }
  return null;
}

module.exports = {
  countPromotionSold,
  getPromotionRemaining,
  enrichPromotionForStore,
  validatePromotionOrder,
  isPromotionRecord,
};
