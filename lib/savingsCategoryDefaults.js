/**
 * Categorías visuales originales de la tienda Bono Ahorro.
 * "Todos" es solo filtro de UI y no se persiste en base de datos.
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

export async function ensureDefaultSavingsCategories(db, lib) {
  const { SavingsCategory } = db;
  const existing = await SavingsCategory.find({});
  const names = new Set(existing.map((c) => c.name));
  const missing = DEFAULT_SAVINGS_CATEGORIES.filter((d) => !names.has(d.name));
  if (!missing.length) return { seeded: false, missing: [] };
  const result = await seedDefaultSavingsCategories(db, lib, { skipExisting: true });
  return { seeded: true, missing: missing.map((m) => m.name), ...result };
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
