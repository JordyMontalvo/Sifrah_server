import db from "../../../components/db";
import lib from "../../../components/lib";

const { Plan } = db;
const { midd, success } = lib;

export default async (req, res) => {
  await midd(req, res);

  if (req.method == "GET") {
    let plans = await Plan.find({});

    // response
    return res.json(
      success({
        plans,
      })
    );
  }
  if (req.method == "POST") {
    const { action } = req.body;

    if (action == "edit") {
      const { id } = req.body;
      const {
        _name,
        _amount,
        _img,
        _affiliation_points,
        _n,
        _max_products,
        _kit,
      } = req.body.data;

      await Plan.update(
        { id },
        {
          $set: {
            name: _name,
            amount: _amount,
            img: _img,
            affiliation_points: _affiliation_points,
            n: _n,
            max_products: _max_products,
            kit: _kit,
          },
        }
      );
    }

    if (action == "add") {
      const { name, amount, img, affiliation_points, n, max_products, kit } =
        req.body.data;

      await Plan.insert({
        id: name.toLowerCase().replace(/\s+/g, "_"),
        name,
        amount,
        img,
        affiliation_points,
        n,
        max_products,
        kit,
      });
    }

    if (action == "delete") {
      const { id } = req.body;
      await Plan.delete({ id });
    }

    // response
    return res.json(success({}));
  }
  if (req.method == "PUT") {
    let plan = await Plan.update(req.body);

    // response
    return res.json(
      success({
        plan,
      })
    );
  }
  if (req.method == "DELETE") {
    let plan = await Plan.delete(req.body);

    // response
    return res.json(
      success({
        plan,
      })
    );
  }
};
