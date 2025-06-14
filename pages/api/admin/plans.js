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
};
