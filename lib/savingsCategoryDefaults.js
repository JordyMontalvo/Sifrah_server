/**
 * Utilidades de categorías Bono Ahorro.
 * Lista de referencia histórica (solo para script manual seed-savings-categories.js).
 */
export const DEFAULT_SAVINGS_CATEGORIES = [
  { name: "Productos SIFRAH", icon: "fas fa-leaf", color: "#e3f2fd", order: 1 },
  { name: "Bienestar", icon: "fas fa-heart", color: "#fce4ec", order: 2 },
  { name: "Hogar", icon: "fas fa-home", color: "#fff3e0", order: 3 },
  { name: "Tecnología", icon: "fas fa-laptop", color: "#e0f2f1", order: 4 },
  { name: "Herramientas", icon: "fas fa-tools", color: "#efebe9", order: 5 },
  { name: "Electrodomésticos", icon: "fas fa-blender", color: "#f1f8e9", order: 6 },
  { name: "Promociones", icon: "fas fa-tag", color: "#fffde7", order: 7 },
];

/** Categorías de referencia para la tienda (diseño desktop) */
export const STORE_DISPLAY_CATEGORIES = [
  { name: "Salud y Bienestar", icon: "fas fa-heartbeat", color: "#fce4ec", order: 1 },
  { name: "Hogar", icon: "fas fa-home", color: "#fff3e0", order: 2 },
  { name: "Tecnología", icon: "fas fa-laptop", color: "#e0f2f1", order: 3 },
  { name: "Electrodomésticos", icon: "fas fa-blender", color: "#f1f8e9", order: 4 },
  { name: "Accesorios", icon: "fas fa-gem", color: "#f3e5f5", order: 5 },
  { name: "Beneficios", icon: "fas fa-gift", color: "#fffde7", order: 6 },
];

const TYPE_LABEL_ALIASES = {
  SALUD: "Salud y Bienestar",
  BELLEZA: "Salud y Bienestar",
  BIENESTAR: "Salud y Bienestar",
  HOGAR: "Hogar",
  TECNOLOGIA: "Tecnología",
  TECNOLOGÍA: "Tecnología",
  ELECTRODOMESTICOS: "Electrodomésticos",
  ELECTRODOMÉSTICOS: "Electrodomésticos",
  ACCESORIOS: "Accesorios",
  BENEFICIOS: "Beneficios",
  PROMOCION: "Promociones",
  PROMOCIÓN: "Promociones",
};

function normalizeCategoryLabel(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (TYPE_LABEL_ALIASES[upper]) return TYPE_LABEL_ALIASES[upper];
  if (TYPE_LABEL_ALIASES[raw]) return TYPE_LABEL_ALIASES[raw];
  return raw
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function categoryLabelFromProduct(product) {
  if (!product) return null;
  return (
    normalizeCategoryLabel(product.sub) ||
    normalizeCategoryLabel(product.type) ||
    null
  );
}

export async function seedDefaultSavingsCategories(db, lib, { skipExisting = true } = {}) {
  const { SavingsCategory, Product } = db;
  const { rand } = lib;

  const created = [];
  const skipped = [];
  const linked = [];

  for (const def of DEFAULT_SAVINGS_CATEGORIES) {
    let category = await SavingsCategory.findOne({ name: def.name });

    if (category) {
      if (skipExisting) {
        skipped.push(def.name);
      } else {
        await SavingsCategory.update(
          { id: category.id },
          {
            icon: def.icon,
            color: def.color,
            order: def.order,
            active: true,
            hidden: false,
            updated_at: new Date(),
          }
        );
      }
    } else {
      const id = rand();
      await SavingsCategory.insert({
        id,
        name: def.name,
        icon: def.icon,
        color: def.color,
        order: def.order,
        active: true,
        hidden: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
      category = { id, name: def.name };
      created.push(def.name);
    }

    if (!category || !category.id) continue;

    const products = await Product.find({ type: def.name });
    for (const product of products) {
      if (!product.savings_category_id || product.savings_category_id !== category.id) {
        await Product.update(
          { id: product.id },
          { savings_category_id: category.id, type: def.name }
        );
        linked.push(product.name || product.id);
      }
    }
  }

  return { created, skipped, linked };
}

export function mapCategoriesForStore(categories = []) {
  return categories
    .filter((c) => c.active !== false && c.hidden !== true)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon || "fas fa-tag",
      color: c.color || "#f1f2f6",
      order: Number(c.order) || 0,
    }));
}

/** Categorías para la tienda: DB → productos → diseño por defecto */
export function resolveStoreCategories(products = [], dbCategories = []) {
  const fromDb = mapCategoriesForStore(dbCategories);
  if (fromDb.length) return fromDb;

  const byName = new Map();
  for (const product of products || []) {
    const label = categoryLabelFromProduct(product);
    if (!label || label === "Promociones") continue;
    if (!byName.has(label)) {
      const preset = STORE_DISPLAY_CATEGORIES.find((c) => c.name === label);
      byName.set(label, {
        id: null,
        name: label,
        icon: preset?.icon || "fas fa-tag",
        color: preset?.color || "#f1f2f6",
        order: preset?.order ?? byName.size + 1,
      });
    }
  }

  const fromProducts = Array.from(byName.values()).sort(
    (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)
  );
  if (fromProducts.length) return fromProducts;

  return STORE_DISPLAY_CATEGORIES.map((c) => ({ ...c, id: null }));
}

export { normalizeCategoryLabel, categoryLabelFromProduct };
