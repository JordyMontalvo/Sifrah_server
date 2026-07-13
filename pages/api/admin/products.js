import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";
import {
  ensureProductSortOrders,
  getNextProductSortOrder,
  PRODUCT_SORT_MONGO,
} from "../../../lib/productSort";

const { Product, Plan, SavingsCategory } = db;
const { midd, success, error, rand } = lib;

const SIFRAH_SAVINGS_CATEGORY_NAME = "Productos SIFRAH";

function isFromSifrahCatalog(product) {
  if (!product) return false;
  if (product.catalog_type === "savings") return false;
  if (product.is_promotion) return false;
  if (Number(product.points) > 0) return true;
  if (product.catalog_type === "sifrah" || product.catalog_type === "both") return true;
  const plans = product.plans || {};
  if (Object.values(plans).some(Boolean)) return true;
  return !!(product.code && Number(product.price) > 0);
}

async function getSifrahSavingsCategoryId() {
  const cat = await SavingsCategory.findOne({ name: SIFRAH_SAVINGS_CATEGORY_NAME });
  return cat ? cat.id : null;
}

async function resolveSavingsCategoryFields(data = {}, product = null) {
  const savings_category_id = data.savings_category_id || null;
  if (!savings_category_id) {
    return { savings_category_id: null };
  }
  const category = await SavingsCategory.findOne({ id: savings_category_id });
  if (!category) {
    return { savings_category_id: null };
  }
  const catalogType = data.catalog_type || product?.catalog_type || "";
  const result = { savings_category_id };
  if (catalogType === "savings") {
    result.type = category.name;
  }
  return result;
}

async function applySifrahSavingsCategoryIfNeeded(product, update) {
  const enabled =
    update.is_savings_bonus !== undefined
      ? update.is_savings_bonus
      : product?.is_savings_bonus;
  if (!product || !enabled) return update;
  if (!isFromSifrahCatalog(product)) return update;
  const catId = await getSifrahSavingsCategoryId();
  if (catId) update.savings_category_id = catId;
  return update;
}

export default async (req, res) => {
  await midd(req, res);
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method == "GET") {
    let products = await Product.find({}, { sort: PRODUCT_SORT_MONGO });
    products = await ensureProductSortOrders(products, Product);

    return res.json(
      success({
        products,
      })
    );
  }

  if (req.method == "POST") {
    console.log("[API Admin Products] POST recibido:", req.body);
    const { action } = req.body;

    if (action == "reorder") {
      const { items } = req.body;
      if (!Array.isArray(items) || !items.length) {
        return res.json(error("items required"));
      }
      for (const item of items) {
        if (!item || !item.id) continue;
        await Product.update(
          { id: item.id },
          { sort_order: Number(item.sort_order) || 0 }
        );
      }
      return res.json(success());
    }

    if (action == "toggle_savings_bonus") {
      const { id, enabled, savings_price: savingsPriceInput } = req.body;
      const found = await Product.find({ id });
      const product = found && found[0];

      if (!product) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }

      const isEnabled = enabled === true || enabled === "true";
      let savings_price = Number(product.savings_price) || 0;

      if (isEnabled) {
        const requested = Number(savingsPriceInput);
        savings_price =
          requested > 0
            ? requested
            : savings_price > 0
              ? savings_price
              : Number(product.price) || 0;
      }

      let catalog_type = product.catalog_type || "";
      if (isEnabled) {
        if (!catalog_type || catalog_type === "sifrah") {
          catalog_type = "both";
        }
      } else if (catalog_type === "both" || catalog_type === "sifrah" || !catalog_type) {
        catalog_type = "sifrah";
      }

      const update = {
        is_savings_bonus: isEnabled,
        savings_price,
        catalog_type,
      };

      if (isEnabled) {
        await applySifrahSavingsCategoryIfNeeded(
          { ...product, catalog_type, is_savings_bonus: true },
          update
        );
      }

      await Product.update({ id }, update);

      return res.json(
        success({
          is_savings_bonus: isEnabled,
          savings_price,
          catalog_type,
          savings_category_id: update.savings_category_id ?? product.savings_category_id ?? null,
        })
      );
    }

    if (action == "update_savings_catalog") {
      const { id } = req.body;
      const {
        savings_price,
        savings_description,
        savings_img,
      } = req.body.data || req.body;

      const found = await Product.find({ id });
      const product = found && found[0];

      if (!product) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }

      const update = {};

      if (savings_price !== undefined) {
        update.savings_price = Number(savings_price) || 0;
      }
      if (savings_description !== undefined) {
        update.savings_description = savings_description;
      }
      if (savings_img !== undefined) {
        update.savings_img = savings_img;
      }

      if (product.is_savings_bonus) {
        await applySifrahSavingsCategoryIfNeeded(product, update);
      }

      await Product.update({ id }, update);

      return res.json(
        success({
          savings_price: update.savings_price ?? product.savings_price ?? 0,
          savings_description:
            update.savings_description ?? product.savings_description ?? "",
          savings_img: update.savings_img ?? product.savings_img ?? "",
          savings_category_id:
            update.savings_category_id ?? product.savings_category_id ?? null,
        })
      );
    }

    if (action == "edit") {
      const { id } = req.body;
      const {
        _name,
        _type,
        _price,
        _points,
        _img,
        _code,
        _description,
        _subdescription = "",
        _plans,
        _weight,
        _prices,
        is_savings_bonus = false,
        savings_price = 0,
        savings_description = "",
        savings_img = "",
        is_promotion = false,
        promotion_active = true,
        available_quantity = 0,
        catalog_type = "",
        savings_category_id = null,
      } = req.body.data;

      const found = await Product.find({ id });
      const existing = found && found[0];
      if (!existing) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }

      const allPlans = await Plan.find({});
      const plansObject = {};
      allPlans.forEach((plan) => {
        plansObject[plan.id] = (_plans && _plans[plan.id]) || false;
      });

      const mergedProduct = {
        ...existing,
        catalog_type: catalog_type || existing.catalog_type,
        points: is_promotion ? 0 : _points,
        plans: plansObject,
        is_promotion: !!is_promotion,
      };

      const categoryFields = await resolveSavingsCategoryFields(
        { savings_category_id, catalog_type: mergedProduct.catalog_type },
        mergedProduct
      );

      let resolvedCatalogType =
        catalog_type || existing.catalog_type || "";
      let resolvedSavingsBonus = !!is_savings_bonus;
      let resolvedPoints = is_promotion ? 0 : _points;

      if (resolvedCatalogType === "sifrah") {
        resolvedSavingsBonus = false;
      } else if (resolvedCatalogType === "both") {
        resolvedSavingsBonus = true;
      } else if (resolvedCatalogType === "savings") {
        resolvedSavingsBonus = true;
        resolvedPoints = 0;
      }

      const updatePayload = {
        code: _code,
        name: _name,
        type: categoryFields.type || _type,
        price: _price,
        points: resolvedPoints,
        img: _img,
        description: _description,
        subdescription: _subdescription,
        plans: plansObject,
        weight: _weight,
        prices: _prices,
        is_savings_bonus: resolvedSavingsBonus,
        savings_price:
          resolvedSavingsBonus && !(Number(savings_price) > 0)
            ? Number(_price) || 0
            : savings_price,
        savings_description,
        savings_img,
        savings_category_id: categoryFields.savings_category_id,
      };

      mergedProduct.catalog_type = resolvedCatalogType || mergedProduct.catalog_type;
      mergedProduct.is_savings_bonus = resolvedSavingsBonus;
      mergedProduct.points = resolvedPoints;

      await applySifrahSavingsCategoryIfNeeded(mergedProduct, updatePayload);

      if (is_promotion !== undefined) updatePayload.is_promotion = !!is_promotion;
      if (promotion_active !== undefined) updatePayload.promotion_active = promotion_active !== false;
      if (available_quantity !== undefined) updatePayload.available_quantity = Number(available_quantity) || 0;
      if (resolvedCatalogType) updatePayload.catalog_type = resolvedCatalogType;

      await Product.update({ id }, updatePayload);
    }

    if (action == "add") {
      const {
        code,
        name,
        type,
        price,
        points,
        img,
        description,
        subdescription = "",
        plans,
        weight,
        prices,
        is_savings_bonus = false,
        savings_price = 0,
        savings_description = "",
        savings_img = "",
        is_promotion = false,
        promotion_active = true,
        available_quantity = 0,
        catalog_type = "",
        savings_category_id = null,
      } = req.body.data;

      const allPlans = await Plan.find({});
      const plansObject = {};
      allPlans.forEach((plan) => {
        plansObject[plan.id] = (plans && plans[plan.id]) || false;
      });

      const isPromo = !!is_promotion || catalog_type === "promotion";
      let resolvedCatalogType = catalog_type || (isPromo ? "promotion" : "");
      let resolvedSavingsBonus = !!is_savings_bonus;
      let resolvedPoints = isPromo ? 0 : points || 0;

      if (resolvedCatalogType === "sifrah") {
        resolvedSavingsBonus = false;
      } else if (resolvedCatalogType === "both") {
        resolvedSavingsBonus = true;
      } else if (resolvedCatalogType === "savings") {
        resolvedSavingsBonus = true;
        resolvedPoints = 0;
      }

      const categoryFields = await resolveSavingsCategoryFields(
        { savings_category_id, catalog_type: resolvedCatalogType },
        {
          catalog_type: resolvedCatalogType,
          points: resolvedPoints,
          plans: plansObject,
          is_promotion: isPromo,
        }
      );

      const insertPayload = {
        id: rand(),
        code: code || "",
        name,
        type: isPromo ? "Promoción" : categoryFields.type || type,
        price: price || 0,
        points: resolvedPoints,
        img: img || "",
        description: description || "",
        subdescription,
        plans: plansObject,
        weight: weight || 0,
        prices: prices || {},
        is_savings_bonus: resolvedSavingsBonus,
        savings_price: savings_price || price || 0,
        savings_description,
        savings_img: savings_img || img || "",
        catalog_type: resolvedCatalogType || (isPromo ? "promotion" : ""),
        is_promotion: isPromo,
        promotion_active: promotion_active !== false,
        available_quantity: Number(available_quantity) || 0,
        savings_category_id: categoryFields.savings_category_id,
        sort_order: await getNextProductSortOrder(Product),
      };

      if (resolvedSavingsBonus) {
        await applySifrahSavingsCategoryIfNeeded(
          {
            catalog_type: insertPayload.catalog_type,
            points: insertPayload.points,
            plans: plansObject,
            code,
            price,
            is_promotion: isPromo,
            is_savings_bonus: true,
          },
          insertPayload
        );
      }

      await Product.insert(insertPayload);
    }

    if (action == "toggle_promotion_active") {
      const { id, enabled } = req.body;
      const active = enabled === true || enabled === "true";
      await Product.update({ id }, { promotion_active: active });
      return res.json(success({ promotion_active: active }));
    }

    if (action == "toggle_promotion_savings") {
      const { id, enabled, savings_price: savingsPriceInput } = req.body;
      const found = await Product.find({ id });
      const product = found && found[0];
      if (!product) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }
      const isEnabled = enabled === true || enabled === "true";
      let savings_price = Number(product.savings_price) || 0;
      if (isEnabled) {
        const requested = Number(savingsPriceInput);
        savings_price =
          requested > 0
            ? requested
            : savings_price > 0
              ? savings_price
              : Number(product.price) || 0;
      }
      await Product.update(
        { id },
        { is_savings_bonus: isEnabled, savings_price }
      );
      return res.json(success({ is_savings_bonus: isEnabled, savings_price }));
    }

    if (action == "delete") {
      const { id } = req.body;
      await Product.delete({ id });
    }

    if (action == "enable_all_plans") {
      const products = await Product.find({});
      const allPlans = await Plan.find({});
      const plansObject = {};

      // Initialize plans object with all available plans set to true
      allPlans.forEach((plan) => {
        plansObject[plan.id] = true;
      });

      for (const product of products) {
        await Product.update(
          { id: product.id },
          {
            plans: plansObject,
          }
        );
      }
    }

    // response
    return res.json(success({}));
  }
};
