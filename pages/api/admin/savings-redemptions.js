import db from "../../../components/db";
import lib from "../../../components/lib";
import { MongoClient } from "mongodb";
import { requireAdmin } from "../../../components/adminAuth";

const URL = process.env.DB_URL;
const name = process.env.DB_NAME;

const { Activation, User, Office, Transaction, AuditLog } = db;
const { error, success, midd, rand } = lib;

const FIELDS = [
  "id",
  "date",
  "products",
  "price",
  "points",
  "status",
  "office",
  "delivered",
  "pay_method",
  "order_type",
  "delivery_info",
  "period_key",
  "period_label",
  "approved_at",
  "transactions",
];
const USER_FIELDS = ["name", "lastName", "dni", "phone"];

const SAVINGS_ORDER_TYPE = "savings_bonus";

async function restoreOfficeStock(officeId, products) {
  if (!officeId || !Array.isArray(products) || !products.length) return;
  const office = await Office.findOne({ id: officeId });
  if (!office || !Array.isArray(office.products)) return;
  products.forEach((p, i) => {
    if (office.products[i] && typeof p.total === "number") {
      office.products[i].total += p.total;
    }
  });
  await Office.update({ id: officeId }, { products: office.products });
}

async function deductOfficeStock(officeId, products) {
  if (!officeId || !Array.isArray(products) || !products.length) return;
  const office = await Office.findOne({ id: officeId });
  if (!office || !Array.isArray(office.products)) return;
  products.forEach((p, i) => {
    if (office.products[i] && typeof p.total === "number") {
      office.products[i].total -= p.total;
    }
  });
  await Office.update({ id: officeId }, { products: office.products });
}

export default async (req, res) => {
  await midd(req, res);
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    const { filter = "all", page = 1, limit = 20, search } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    let baseFilter = { order_type: SAVINGS_ORDER_TYPE };
    if (filter && filter !== "all") {
      baseFilter.status = filter;
    }

    try {
      const client = new MongoClient(URL);
      await client.connect();
      const database = client.db(name);

      if (search) {
        const searchWords = search
          .trim()
          .split(/\s+/)
          .map((w) => w.toLowerCase());
        const userSearchQuery = {
          $and: searchWords.map((word) => ({
            $or: [
              { name: { $regex: word, $options: "i" } },
              { lastName: { $regex: word, $options: "i" } },
              { dni: { $regex: word, $options: "i" } },
            ],
          })),
        };
        const users = await database
          .collection("users")
          .find(userSearchQuery)
          .toArray();
        const userIds = users.map((u) => String(u.id));
        baseFilter.userId =
          userIds.length > 0 ? { $in: userIds } : "__NO_MATCH__";
      }

      const collection = database.collection("activations");
      const [items, total] = await Promise.all([
        collection
          .find(baseFilter)
          .sort({ date: -1 })
          .skip(skip)
          .limit(limitNum)
          .toArray(),
        collection.countDocuments(baseFilter),
      ]);

      await client.close();

      const userIds = [...new Set(items.map((i) => i.userId).filter(Boolean))];
      let users = await User.find({ id: { $in: userIds } });
      users = lib.map(users);

      const offices = await Office.find({});
      const officeMap = {};
      offices.forEach((o) => {
        officeMap[o.id] = o.name;
      });

      const redemptions = items.map((item) => {
        const u = lib.model(users.get(item.userId) || {}, USER_FIELDS);
        const row = lib.model(item, FIELDS);
        return {
          ...row,
          ...u,
          officeName: officeMap[row.office] || row.office || "—",
          productsSummary: (row.products || [])
            .map((p) => `${p.name || "Producto"} x${p.total || 1}`)
            .join(", "),
        };
      });

      const statsFilter = { order_type: SAVINGS_ORDER_TYPE };
      const client2 = new MongoClient(URL);
      await client2.connect();
      const db2 = client2.db(name);
      const allForStats = await db2
        .collection("activations")
        .find(statsFilter)
        .project({ status: 1, price: 1 })
        .toArray();
      await client2.close();

      const stats = {
        total: allForStats.length,
        pending: allForStats.filter((r) => r.status === "pending").length,
        approved: allForStats.filter((r) => r.status === "approved").length,
        totalAmount: allForStats.reduce(
          (sum, r) => sum + Number(r.price || 0),
          0
        ),
      };

      return res.json(
        success({
          redemptions,
          stats,
          total,
          totalPages: Math.ceil(total / limitNum),
          currentPage: pageNum,
        })
      );
    } catch (e) {
      console.error("[savings-redemptions GET]", e);
      return res.status(500).json(error("Database connection error"));
    }
  }

  if (req.method === "POST") {
    const { action, id } = req.body;
    if (!id) return res.json(error("id required"));

    const redemption = await Activation.findOne({
      id,
      order_type: SAVINGS_ORDER_TYPE,
    });
    if (!redemption) return res.json(error("redemption not found"));

    if (action === "approve" || action === "reject") {
      if (redemption.status === "approved")
        return res.json(error("already approved"));
      if (redemption.status === "rejected")
        return res.json(error("already rejected"));
      if (redemption.status === "cancelled")
        return res.json(error("already cancelled"));
    }

    if (action === "approve") {
      const user = await User.findOne({ id: redemption.userId });
      if (!user) return res.json(error("user not found"));

      const userTx = await Transaction.find({
        user_id: user.id,
        virtual: { $in: [null, false] },
      });
      const savingsBalance = lib.calcSavingsBonusBalance(userTx);
      const price = Number(redemption.price) || 0;

      if (price <= 0) return res.json(error("invalid price"));
      if (savingsBalance < price) {
        return res.json(
          error("Saldo Bono Ahorro insuficiente para aprobar el canje")
        );
      }

      const txId = rand();
      const approvedAt = new Date();
      const transactions = Array.isArray(redemption.transactions)
        ? [...redemption.transactions]
        : [];
      transactions.push(txId);

      await Transaction.insert({
        id: txId,
        date: approvedAt,
        user_id: user.id,
        type: "out",
        value: price,
        name: "savings_bonus_redemption",
        desc: `Canje Bono Ahorro #${id}`,
        virtual: false,
        wallet_tipo: "BONO_AHORRO",
        activation_id: id,
      });

      await Activation.update(
        { id },
        {
          status: "approved",
          approved_at: approvedAt,
          delivered: false,
          transactions,
        }
      );

      await deductOfficeStock(redemption.office, redemption.products);

      await lib.createAuditLog(AuditLog, {
        collection: "activations",
        action: "approve_savings_bonus",
        target_id: id,
        user_id: user.id,
        admin_id: auth.user.id,
        state_after: { price, savingsBalance: savingsBalance - price },
      });

      return res.json(success());
    }

    if (action === "reject") {
      await Activation.update({ id }, { status: "rejected" });

      await lib.createAuditLog(AuditLog, {
        collection: "activations",
        action: "reject_savings_bonus",
        target_id: id,
        user_id: redemption.userId,
        admin_id: auth.user.id,
      });

      return res.json(success());
    }

    if (action === "check") {
      await Activation.update({ id }, { delivered: true });
      return res.json(success());
    }

    if (action === "uncheck") {
      await Activation.update({ id }, { delivered: false });
      return res.json(success());
    }

    if (action === "cancel") {
      const wasApproved = redemption.status === "approved";

      if (wasApproved && redemption.transactions?.length) {
        for (const txId of redemption.transactions) {
          await Transaction.delete({ id: txId });
        }
        await restoreOfficeStock(redemption.office, redemption.products);
      }

      await Activation.update(
        { id },
        { status: "cancelled", cancelled_at: new Date() }
      );

      await lib.createAuditLog(AuditLog, {
        collection: "activations",
        action: "cancel_savings_bonus",
        target_id: id,
        user_id: redemption.userId,
        admin_id: auth.user.id,
      });

      return res.json(success({ message: "Canje anulado correctamente" }));
    }

    return res.json(error("invalid action"));
  }

  return res.json(error("method not allowed"));
};
