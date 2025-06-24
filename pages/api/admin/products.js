import db from "../../../components/db";
import lib from "../../../components/lib";

const { Product, Plan } = db;
const { midd, success, rand } = lib;

export default async (req, res) => {
  await midd(req, res);

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
    const { action } = req.body;

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
        _plans,
        _weight,
      } = req.body.data;

      // Get all plans from database
      const allPlans = await Plan.find({});
      const plansObject = {};

      // Initialize plans object with all available plans
      allPlans.forEach((plan) => {
        plansObject[plan.id] = _plans[plan.id] || false;
      });

      await Product.update(
        { id },
        {
          code: _code,
          name: _name,
          type: _type,
          price: _price,
          points: _points,
          img: _img,
          description: _description,
          plans: plansObject,
          weight: _weight,
        }
      );
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
        plans,
        weight,
      } = req.body.data;

      // Get all plans from database
      const allPlans = await Plan.find({});
      const plansObject = {};

      // Initialize plans object with the plans sent from frontend
      allPlans.forEach((plan) => {
        plansObject[plan.id] = plans[plan.id] || false;
      });

      await Product.insert({
        id: rand(),
        code,
        name,
        type,
        price,
        points,
        img,
        description,
        plans: plansObject,
        weight,
      });
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
