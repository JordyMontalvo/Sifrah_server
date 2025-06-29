import db from "../../../components/db";
import lib from "../../../components/lib";
import Joi from "joi";
import { validateBody, validateQuery } from "../../../components/validate";

const { Collect, User } = db;
const { error, success, midd, ids, map, model } = lib;

// valid filters
// const q = { all: {}, pending: { status: 'pending'} }

// models
const A = [
  "id",
  "date",
  "cash",
  "bank",
  "account",
  "account_type",
  "amount",
  "office",
  "status",
];
const U = ["name", "lastName", "username", "phone"];

const handler = async (req, res) => {
  if (req.method == "GET") {
    // Validar query
    const querySchema = Joi.object({
      filter: Joi.string().valid("all", "pending").required(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      account: Joi.string().required(),
    });
    if (!validateQuery(querySchema, req, res)) return;

    const { filter, page = 1, limit = 20 } = req.query;

    const q = { all: {}, pending: { status: "pending" } };

    // validate filter
    if (!(filter in q)) return res.json(error("invalid filter"));

    const { account } = req.query;
    console.log({ account });

    // get collects
    let qq = q[filter];
    console.log({ qq });

    if (account != "admin") qq.office = account;
    console.log({ qq });

    // PAGINACION
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Collect.count(qq);
    let collects = await Collect.findPaginated(qq, skip, parseInt(limit));

    // get users for collects
    let users = await User.find({ id: { $in: ids(collects) } });
    users = map(users);

    // enrich collects
    collects = collects.map((a) => {
      let u = users.get(a.userId);

      a = model(a, A);
      u = model(u, U);

      return {
        ...a,
        ...u,
        name: (u && u.name) || "",
        lastName: (u && u.lastName) || "",
        username: (u && u.username) || "",
        phone: (u && u.phone) || "",
        id: a.id || "",
        date: a.date || "",
        cash: a.cash || false,
        bank: a.bank || "",
        account: a.account || "",
        account_type: a.account_type || "",
        amount: a.amount || 0,
        office: a.office || "",
        status: a.status || "",
      };
    });

    // response
    return res.json(success({ collects, total }));
  }

  if (req.method == "POST") {
    // Validar body
    const bodySchema = Joi.object({
      action: Joi.string().valid("approve").required(),
      id: Joi.string().required(),
    });
    if (!validateBody(bodySchema, req, res)) return;

    const { action, id } = req.body;

    // get collect
    const collect = await Collect.findOne({ id });

    // validate collect
    if (!collect) return res.json(error("collect not exist"));

    // validate status
    if (collect.status == "approved")
      return res.json(error("already approved"));

    if (action == "approve") {
      // approve collect
      await Collect.update({ id }, { status: "approved" });

      // obtener collect actualizado
      const updated = await Collect.findOne({ id });
      // response
      return res.json(success({ collect: updated }));
    }
  }
};

export default async (req, res) => {
  await midd(req, res);
  return handler(req, res);
};
