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
    let plan = await Plan.insert(req.body);

    // response
    return res.json(
      success({
        plan,
      })
    );
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
