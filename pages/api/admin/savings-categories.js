import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";
import { seedDefaultSavingsCategories, ensureDefaultSavingsCategories, mapCategoriesForStore } from "../../../lib/savingsCategoryDefaults";
const { SavingsCategory, Product } = db;
const { success, error, midd, rand } = lib;

function normalizeCategoryPayload(data = {}) {
  const name = String(data.name || "").trim();
  const icon = String(data.icon || "fas fa-tag").trim() || "fas fa-tag";
  const color = String(data.color || "#f1f2f6").trim() || "#f1f2f6";
  const active = data.active !== false;
  const hidden = data.hidden === true;
  const order = Number(data.order) || 0;
  return { name, icon, color, active, hidden, order };
}

export default async (req, res) => {
  await midd(req, res);
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    try {
      await ensureDefaultSavingsCategories(db, lib);
      let categories = await SavingsCategory.find({});
      const products = await Product.find({ is_savings_bonus: true });
      const counts = {};
      products.forEach((p) => {
        if (p.savings_category_id) {
          counts[p.savings_category_id] = (counts[p.savings_category_id] || 0) + 1;
        }
      });
      const enriched = categories
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
        .map((c) => ({
        ...c,
        product_count: counts[c.id] || 0,
      }));
      return res.json(success({ categories: enriched }));
    } catch (e) {
      console.error("[savings-categories GET]", e);
      return res.status(500).json(error("Internal Server Error"));
    }
  }

  if (req.method === "POST") {
    try {
      const { action } = req.body;

      if (action === "add") {
        const payload = normalizeCategoryPayload(req.body.data);
        if (!payload.name) {
          return res.json(error("El nombre es obligatorio"));
        }
        const existing = await SavingsCategory.findOne({ name: payload.name });
        if (existing) {
          return res.json(error("Ya existe una categoría con ese nombre"));
        }
        await SavingsCategory.insert({
          id: rand(),
          ...payload,
          created_at: new Date(),
          updated_at: new Date(),
        });
        return res.json(success({}));
      }

      if (action === "edit") {
        const { id } = req.body;
        if (!id) return res.json(error("ID requerido"));
        const payload = normalizeCategoryPayload(req.body.data);
        if (!payload.name) {
          return res.json(error("El nombre es obligatorio"));
        }
        const current = await SavingsCategory.findOne({ id });
        if (!current) return res.json(error("Categoría no encontrada"));
        const duplicate = await SavingsCategory.findOne({ name: payload.name });
        if (duplicate && duplicate.id !== id) {
          return res.json(error("Ya existe otra categoría con ese nombre"));
        }
        await SavingsCategory.update(
          { id },
          { ...payload, updated_at: new Date() }
        );
        const products = await Product.find({ savings_category_id: id });
        for (const product of products) {
          await Product.update({ id: product.id }, { type: payload.name });
        }
        return res.json(success({}));
      }

      if (action === "toggle_active") {
        const { id, active } = req.body;
        if (!id) return res.json(error("ID requerido"));
        await SavingsCategory.update(
          { id },
          { active: active !== false, updated_at: new Date() }
        );
        return res.json(success({ active: active !== false }));
      }

      if (action === "toggle_hidden") {
        const { id, hidden } = req.body;
        if (!id) return res.json(error("ID requerido"));
        await SavingsCategory.update(
          { id },
          { hidden: hidden === true, updated_at: new Date() }
        );
        return res.json(success({ hidden: hidden === true }));
      }

      if (action === "delete") {
        const { id } = req.body;
        if (!id) return res.json(error("ID requerido"));
        const linked = await Product.find({ savings_category_id: id });
        if (linked.length) {
          return res.json(
            error(
              `No se puede eliminar: ${linked.length} producto(s) usan esta categoría. Ocúltela o reasígnelos primero.`
            )
          );
        }
        await SavingsCategory.delete({ id });
        return res.json(success({}));
      }

      if (action === "seed_defaults") {
        const result = await seedDefaultSavingsCategories(db, lib, {
          skipExisting: req.body.skipExisting !== false,
        });
        return res.json(success(result));
      }

      return res.json(error("Acción no válida"));    } catch (e) {
      console.error("[savings-categories POST]", e);
      return res.status(500).json(error("Internal Server Error"));
    }
  }

  if (req.method === "DELETE") {
    try {
      const { id } = req.body;
      if (!id) return res.json(error("ID requerido"));
      const linked = await Product.find({ savings_category_id: id });
      if (linked.length) {
        return res.json(
          error(
            `No se puede eliminar: ${linked.length} producto(s) usan esta categoría.`
          )
        );
      }
      await SavingsCategory.delete({ id });
      return res.json(success({ message: "Categoría eliminada" }));
    } catch (e) {
      console.error("[savings-categories DELETE]", e);
      return res.status(500).json(error("Internal Server Error"));
    }
  }
};
