/**
 * Reglas de catálogo:
 * - Exclusivo Bono Ahorro: is_savings_bonus === true y sin puntos (points <= 0)
 * - Dual (ambas tiendas): is_savings_bonus === true y points > 0
 * - Tienda principal: is_savings_bonus !== true, o dual con puntos
 */

function isSavingsOnlyProduct(product) {
  if (!product) return false;
  return product.is_savings_bonus === true && !(Number(product.points) > 0);
}

function mainCatalogMongoFilter() {
  return {
    $or: [
      { is_savings_bonus: { $ne: true } },
      { is_savings_bonus: { $exists: false } },
      { points: { $gt: 0 } },
    ],
  };
}

function savingsCatalogMongoFilter() {
  return { is_savings_bonus: true };
}

function filterMainCatalogProducts(products) {
  return (products || []).filter((p) => !isSavingsOnlyProduct(p));
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

module.exports = {
  isSavingsOnlyProduct,
  mainCatalogMongoFilter,
  savingsCatalogMongoFilter,
  filterMainCatalogProducts,
  findSavingsOnlyInOrder,
};
