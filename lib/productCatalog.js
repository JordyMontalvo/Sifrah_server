/**
 * Reglas de catálogo:
 * - catalog_type = "sifrah": solo Tienda SIFRAH
 * - catalog_type = "both": Tienda SIFRAH + Bono Ahorro
 * - catalog_type = "savings": solo Bono Ahorro (canje externo)
 * - Legacy sin catalog_type:
 *   - is_savings_bonus && points <= 0 → solo Bono Ahorro
 *   - is_savings_bonus && points > 0 → ambas tiendas
 *   - !is_savings_bonus → Tienda SIFRAH
 * - Promoción: is_promotion === true
 */

function isSavingsOnlyProduct(product) {
  if (!product) return false;
  if (product.catalog_type === "sifrah" || product.catalog_type === "both") {
    return false;
  }
  if (product.catalog_type === "savings") return true;
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
      { catalog_type: "sifrah" },
      { catalog_type: "both" },
      {
        $and: [
          { catalog_type: { $nin: ["savings", "promotion"] } },
          {
            $or: [
              { is_savings_bonus: { $ne: true } },
              { is_savings_bonus: { $exists: false } },
              { points: { $gt: 0 } },
            ],
          },
        ],
      },
    ],
  };
}

function savingsCatalogMongoFilter() {
  return {
    catalog_type: { $ne: "sifrah" },
    $or: [
      { catalog_type: "savings" },
      { catalog_type: "both" },
      { is_savings_bonus: true },
    ],
  };
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
