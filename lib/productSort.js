const PRODUCT_SORT_STEP = 10;

export const PRODUCT_SORT_MONGO = { sort_order: 1, name: 1, code: 1 };

export function compareProducts(a, b) {
  const ao = Number(a && a.sort_order);
  const bo = Number(b && b.sort_order);
  const aHas = Number.isFinite(ao);
  const bHas = Number.isFinite(bo);
  if (aHas && bHas && ao !== bo) return ao - bo;
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;
  const nameCmp = String((a && a.name) || "").localeCompare(String((b && b.name) || ""));
  if (nameCmp !== 0) return nameCmp;
  return String((a && a.code) || "").localeCompare(String((b && b.code) || ""));
}

export function sortProducts(products) {
  return [...(products || [])].sort(compareProducts);
}

export async function ensureProductSortOrders(products, Product) {
  if (!Array.isArray(products) || !products.length) return [];

  const missing = products.filter(
    (p) =>
      p.sort_order == null ||
      p.sort_order === undefined ||
      !Number.isFinite(Number(p.sort_order))
  );

  if (missing.length) {
    let maxOrder = 0;
    for (const p of products) {
      const n = Number(p.sort_order);
      if (Number.isFinite(n)) maxOrder = Math.max(maxOrder, n);
    }

    let next = maxOrder + PRODUCT_SORT_STEP;
    const orderedMissing = sortProducts(missing);
    for (const p of orderedMissing) {
      p.sort_order = next;
      await Product.update({ id: p.id }, { sort_order: next });
      next += PRODUCT_SORT_STEP;
    }
  }

  return sortProducts(products);
}

export async function getNextProductSortOrder(Product) {
  const all = await Product.find({});
  let max = 0;
  for (const p of all) {
    const n = Number(p.sort_order);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return max + PRODUCT_SORT_STEP;
}
