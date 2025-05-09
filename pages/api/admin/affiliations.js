import db from "../../../components/db";
import lib from "../../../components/lib";

const { Affiliation, User, Tree, Token, Transaction, Office } = db;
const { error, success, midd, ids, parent_ids, map, model, rand } = lib;

const A = [
  "id",
  "date",
  "plan",
  "voucher",
  "status",
  "office",
  "delivered",
  "pay_method",
  "bank",
  "voucher_date",
  "voucher_number",
  "amounts",
  "products",
];
const U = ["name", "lastName", "dni", "phone"];

let users = null;
let tree = null;

const pay = {
  early: [0.3],
  basic: [0.3, 0.05, 0.02, 0.01, 0.01, 0.005, 0.005, 0.005, 0.005],
  standard: [0.35, 0.05, 0.02, 0.01, 0.01, 0.005, 0.005, 0.005, 0.005],
  master: [0.4, 0.05, 0.02, 0.01, 0.01, 0.005, 0.005, 0.005, 0.005],
};

let pays = [];

async function pay_bonus(id, i, aff_id, amount, migration, plan, _id) {
  const user = users.find((e) => e.id == id);
  const node = tree.find((e) => e.id == id);

  const virtual = user._activated || user.activated ? false : true;

  const name = migration ? "migration bonus" : "affiliation bonus";

  if (i <= user.n - 1) {
    let p = pay[user.plan][i];

    const id = rand();

    await Transaction.insert({
      id,
      date: new Date(),
      user_id: user.id,
      type: "in",
      value: p * amount,
      name,
      affiliation_id: aff_id,
      virtual,
      _user_id: _id,
    });

    pays.push(id);
  }

  if (i == 9 || !node.parent) return;

  pay_bonus(node.parent, i + 1, aff_id, amount, migration, plan, _id);
}

const handler = async (req, res) => {

  if(req.method == 'GET') {
    // Obtener parámetros de paginación
    const { filter, page = 1, limit = 20, search } = req.query
    console.log('Received request with page:', page, 'and limit:', limit, 'search:', search);
    
    // Convertir a números
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    
    const q = { all: {}, pending: { status: 'pending'} }

    if (!(filter in q)) return res.json(error('invalid filter'))

    const { account } = req.query

    // get AFFILIATIONS
    let qq = q[filter]

    if(account != 'admin') qq.office = account

    try {
      // Primero obtener todas las afiliaciones que coinciden con el filtro
      let allAffiliations = await Affiliation.find(qq);
      
      // get USERS for affiliations
      let users = await User.find({})
      users = map(users)

      // Apply search if search parameter exists
      if (search) {
        const searchLower = search.toLowerCase();
        allAffiliations = allAffiliations.filter(aff => {
          const user = users.get(aff.userId);
          return user && (
            user.name?.toLowerCase().includes(searchLower) ||
            user.lastName?.toLowerCase().includes(searchLower) ||
            user.dni?.toLowerCase().includes(searchLower) ||
            user.phone?.toLowerCase().includes(searchLower)
          );
        });
      }
      
      // Ordenar manualmente por fecha (del más reciente al más antiguo)
      allAffiliations.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Obtener el total antes de paginar
      const totalAffiliations = allAffiliations.length;
      
      // Aplicar paginación manualmente
      let affiliations = allAffiliations.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      
      // Obtener solo los usuarios necesarios para las afiliaciones paginadas
      users = await User.find({ id: { $in: ids(affiliations) } })
      users = map(users)

      // enrich affiliations
      affiliations = affiliations.map(a => {
        let u = users.get(a.userId)
        a = model(a, A)
        u = model(u, U)
        return { ...a, ...u }
      })

      let parents = await User.find({ id: { $in: parent_ids(affiliations) } })

      // Devolver los resultados con información de paginación
      return res.json(success({
        affiliations,
        total: totalAffiliations,
        totalPages: Math.ceil(totalAffiliations / limitNum),
        currentPage: pageNum,
      }));
    } catch (err) {
      console.error('Database error:', err);
      return res.status(500).json(error('Database error'));
    }
  }

  if (req.method == "POST") {
    const { id, action } = req.body;

    // get affiliation
    let affiliation = await Affiliation.findOne({ id });

    // validate affiliation
    if (!affiliation) return res.json(error("affiliation not exist"));

    if (action == "approve" || action == "reject") {
      if (affiliation.status == "approved")
        return res.json(error("already approved"));
      if (affiliation.status == "rejected")
        return res.json(error("already rejected"));
    }

    if (action == "approve") {
      // approve AFFILIATION
      await Affiliation.update({ id }, { status: "approved" });

      // update USER
      const user = await User.findOne({ id: affiliation.userId });

      await User.update(
        { id: user.id },
        {
          affiliated: true,
          _activated: true,
          activated: true,
          affiliation_date: new Date(),
          plan: affiliation.plan.id,
          n: affiliation.plan.n,
          affiliation_points: affiliation.plan.affiliation_points,
        }
      );

      if (!user.tree) {
        // reserve Token
        const token = await Token.findOne({ free: true });
        if (!token) return res.json(error("token not available"));
        await Token.update({ value: token.value }, { free: false });

        // insert to tree
        const parent = await User.findOne({ id: user.parentId });
        const coverage = parent.coverage;

        let _id = coverage.id;
        let node = await Tree.findOne({ id: _id });

        node.childs.push(user.id);

        await Tree.update({ id: _id }, { childs: node.childs });
        await Tree.insert({ id: user.id, childs: [], parent: _id });

        // update USER
        await User.update(
          { id: user.id },
          {
            tree: true,
            coverage: { id: user.id },
            token: token.value,
          }
        );
      }

      // PAY AFFILIATION BONUS
      tree = await Tree.find({});
      users = await User.find({});
      pays = [];

      const plan = affiliation.plan.id;
      const amount = affiliation.plan.amount - 50;

      if (user.plan == "default") {
        pay_bonus(
          user.parentId,
          0,
          affiliation.id,
          amount,
          false,
          plan,
          user.id
        );
      } else {
        pay_bonus(
          user.parentId,
          0,
          affiliation.id,
          amount,
          true,
          plan,
          user.id
        );
      }

      // UPDATE STOCK
      const office_id = affiliation.office;
      const products = affiliation.products;

      const office = await Office.findOne({ id: office_id });

      products.forEach((p, i) => {
        if (office.products[i]) office.products[i].total -= products[i].total;
      });

      await Office.update(
        { id: office_id },
        {
          products: office.products,
        }
      );

      // migrar transaccinoes virtuales
      const transactions = await Transaction.find({
        user_id: user.id,
        virtual: true,
      });

      for (let transaction of transactions) {
        console.log({ transaction });
        await Transaction.update({ id: transaction.id }, { virtual: false });
      }
    }

    if (action == "reject") {
      await Affiliation.update({ id }, { status: "rejected" });

      // revert transactions
      if (affiliation.transactions) {
        for (let transactionId of affiliation.transactions) {
          await Transaction.delete({ id: transactionId });
        }
      }
    }

    if (action == "check") {
      await Affiliation.update({ id }, { delivered: true });
    }

    if (action == "uncheck") {
      await Affiliation.update({ id }, { delivered: false });
    }

    if (action == "revert") {
      console.log("revert");

      const user = await User.findOne({ id: affiliation.userId });

      await Affiliation.delete({ id });

      const transactions = affiliation.transactions;
      console.log(transactions);

      for (let id of transactions) {
        await Transaction.delete({ id });
      }

      const affiliations = await Affiliation.find({
        userId: user.id,
        status: "approved",
      });

      if (affiliations.length) {
        affiliation = affiliations[affiliations.length - 1];

        await User.update(
          { id: user.id },
          {
            // affiliated: false,
            _activated: false,
            activated: false,
            plan: affiliation.plan.id,
            affiliation_date: affiliation.date,
            affiliation_points: affiliation.plan.affiliation_points,
            n: affiliation.plan.n,
          }
        );
      } else {
        await User.update(
          { id: user.id },
          {
            affiliated: false,
            _activated: false,
            activated: false,
            plan: "default",
            affiliation_date: null,
            affiliation_points: 0,
            n: 0,
          }
        );
      }

      // UPDATE STOCK
      console.log("UPDATE STOCK ...");
      const office_id = affiliation.office;
      const products = affiliation.products;

      const office = await Office.findOne({ id: office_id });

      products.forEach((p, i) => {
        if (office.products[i]) office.products[i].total += products[i].total;
      });

      await Office.update(
        { id: office_id },
        {
          products: office.products,
        }
      );
    }

    return res.json(success());
  }
};

export default async (req, res) => {
  await midd(req, res);
  return handler(req, res);
};
