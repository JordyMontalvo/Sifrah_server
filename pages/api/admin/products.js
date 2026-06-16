import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

const { Product, Plan, SavingsCategory } = db;
const { midd, success, rand } = lib;

async function resolveSavingsCategoryFields(data = {}) {
  const savings_category_id = data.savings_category_id || null;
  if (!savings_category_id) {
    return { savings_category_id: null };
  }
  const category = await SavingsCategory.findOne({ id: savings_category_id });
  if (!category) {
    return { savings_category_id: null };
  }
  return {
    savings_category_id,
    type: category.name,
  };
}

export default async (req, res) => {
  await midd(req, res);
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method == "GET") {
    let products = await Product.find({});

    // response
    return res.json(
      success({
        products,
      })
    );
  }

  if (req.method == "POST") {
    console.log("[API Admin Products] POST recibido:", req.body);
    const { action } = req.body;

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

      await Product.update(
        { id },
        {
          is_savings_bonus: isEnabled,
          savings_price,
        }
      );

      return res.json(
        success({
          is_savings_bonus: isEnabled,
          savings_price,
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

      await Product.update({ id }, update);

      return res.json(
        success({
          savings_price: update.savings_price ?? product.savings_price ?? 0,
          savings_description:
            update.savings_description ?? product.savings_description ?? "",
          savings_img: update.savings_img ?? product.savings_img ?? "",
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

      const allPlans = await Plan.find({});
      const plansObject = {};
      allPlans.forEach((plan) => {
        plansObject[plan.id] = (_plans && _plans[plan.id]) || false;
      });

      const categoryFields = await resolveSavingsCategoryFields({
        savings_category_id,
      });

      const updatePayload = {
        code: _code,
        name: _name,
        type: categoryFields.type || _type,
        price: _price,
        points: is_promotion ? 0 : _points,
        img: _img,
        description: _description,
        subdescription: _subdescription,
        plans: is_promotion ? plansObject : plansObject,
        weight: _weight,
        prices: _prices,
        is_savings_bonus,
        savings_price,
        savings_description,
        savings_img,
        savings_category_id: categoryFields.savings_category_id,
      };

      if (is_promotion !== undefined) updatePayload.is_promotion = !!is_promotion;
      if (promotion_active !== undefined) updatePayload.promotion_active = promotion_active !== false;
      if (available_quantity !== undefined) updatePayload.available_quantity = Number(available_quantity) || 0;
      if (catalog_type) updatePayload.catalog_type = catalog_type;

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
      const categoryFields = await resolveSavingsCategoryFields({
        savings_category_id,
      });

      await Product.insert({
        id: rand(),
        code: code || "",
        name,
        type: isPromo ? "Promoción" : categoryFields.type || type,
        price: price || 0,
        points: isPromo ? 0 : points || 0,
        img: img || "",
        description: description || "",
        subdescription,
        plans: plansObject,
        weight: weight || 0,
        prices: prices || {},
        is_savings_bonus: !!is_savings_bonus,
        savings_price: savings_price || price || 0,
        savings_description,
        savings_img: savings_img || img || "",
        catalog_type: catalog_type || (isPromo ? "promotion" : ""),
        is_promotion: isPromo,
        promotion_active: promotion_active !== false,
        available_quantity: Number(available_quantity) || 0,
        savings_category_id: categoryFields.savings_category_id,
      });
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
