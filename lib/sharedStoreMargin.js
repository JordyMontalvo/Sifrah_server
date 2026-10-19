/**
 * Ganancia del socio por ventas en su tienda compartida.
 *
 * El cliente paga el precio público; la diferencia con el precio socio
 * (price_socio) es la ganancia del socio. Se calcula sobre el precio unitario
 * cobrado (sin delivery) y solo cuando existe un precio socio válido.
 */

export function unitMargin(unitPrice, socioPrice) {
  const price = Number(unitPrice) || 0;
  const socio = Number(socioPrice) || 0;
  if (price <= 0 || socio <= 0) return 0;
  return Math.max(0, price - socio);
}

/**
 * Suma la ganancia de todos los productos de un pedido.
 * Los productos sin precio socio snapshot (pedidos anteriores) usan el precio
 * socio actual del catálogo, pasado en `socioPriceById` (Map id -> price_socio).
 */
export function sharedStoreMarginTotal(products = [], socioPriceById = new Map()) {
  if (!Array.isArray(products)) return 0;
  return products.reduce((sum, p) => {
    const socio =
      p.price_socio != null ? p.price_socio : socioPriceById.get(String(p.id));
    return sum + unitMargin(p.price, socio) * (Number(p.total) || 0);
  }, 0);
}
