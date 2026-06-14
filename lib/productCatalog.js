/**
 * Reglas de catálogo:
 * - Exclusivo Bono Ahorro: is_savings_bonus === true y sin puntos (points <= 0)
 * - Dual (ambas tiendas): is_savings_bonus === true y points > 0
 * - Promoción: is_promotion === true (sin puntos, sin plan compensación)
 * - Tienda principal: productos SIFRAH + promociones activas
 */

function isSavingsOnlyProduct(product) {
  if (!product) return false;
  return product.is_savings_bonus === true && !(Number(product.points) > 0);
}

function isPromotionProduct(product) {
  if (!product) return false;
  return (
    product.is_promotion === true ||
    product.catalog_type === "promotion" ||
    product.type === "Promoción"
  );
}

function mainCatalogMongoFilter() {
  return {
    $or: [
      { is_promotion: true },
      { is_savings_bonus: { $ne: true } },
      { is_savings_bonus: { $exists: false } },
      { points: { $gt: 0 } },
    ],
  };
}

function savingsCatalogMongoFilter() {
  return { is_savings_bonus: true };
}

function promotionsCatalogMongoFilter() {
  return { is_promotion: true };
}

function filterMainCatalogProducts(products) {
  return (products || []).filter((p) => !isSavingsOnlyProduct(p));
}

function filterSifrahCatalogProducts(products) {
  return (products || []).filter(
    (p) => !isSavingsOnlyProduct(p) && !isPromotionProduct(p)
  );
}

function filterPromotionCatalogProducts(products) {
  return (products || []).filter((p) => isPromotionProduct(p));
}

function findSavingsOnlyInOrder(items, catalogById) {
  for (const item of items || []) {
    const dbProduct = catalogById.get(String(item.id));
    if (dbProduct && isSavingsOnlyProduct(dbProduct)) {
      return dbProduct;
    }
  }
  return null;
}

function findPromotionInOrder(items, catalogById) {
  for (const item of items || []) {
    const dbProduct = catalogById.get(String(item.id));
    if (dbProduct && isPromotionProduct(dbProduct)) {
      return dbProduct;
    }
  }
  return null;
}

module.exports = {
  isSavingsOnlyProduct,
  isPromotionProduct,
  mainCatalogMongoFilter,
  savingsCatalogMongoFilter,
  promotionsCatalogMongoFilter,
  filterMainCatalogProducts,
  filterSifrahCatalogProducts,
  filterPromotionCatalogProducts,
  findSavingsOnlyInOrder,
  findPromotionInOrder,
};
