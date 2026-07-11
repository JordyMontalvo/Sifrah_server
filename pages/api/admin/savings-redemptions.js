import db from "../../../components/db";
import lib from "../../../components/lib";
import { MongoClient } from "mongodb";
import { requireAdmin } from "../../../components/adminAuth";

const URL = process.env.DB_URL;
const name = process.env.DB_NAME;

const { Activation, User, Office, Transaction, AuditLog, Period } = db;
const { error, success, midd, rand } = lib;
const { syncOrderTransactionsPeriod } = require("../../../lib/transactionPeriod");
const { resolvePeriodAtApproval } = require("../../../lib/periodAtApproval");

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
  "voucher",
  "voucher2",
  "amounts",
  "bank",
  "bank_info",
  "payment_breakdown",
  "voucher_number",
  "transaction_id",
  "authorization_code",
];
const USER_FIELDS = ["name", "lastName", "dni", "phone"];

function formatVoucherField(url) {
  if (!url || typeof url !== "string") {
    return { url: "", isImage: false };
  }
  const isImage = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|svg))/i.test(url);
  return { url, isImage };
}

function productsLabel(products) {
  if (!Array.isArray(products) || !products.length) return "—";
  const label = products
    .filter((p) => Number(p.total) > 0)
    .map((p) => `${p.name || "Producto"} x${p.total || 1}`)
    .join(", ");
  return label || "—";
}

function externalPayLabel(item) {
  if (!item) return null;
  if (item.pay_method === "credit-card") return "Tarjeta Izipay";
  if (item.pay_method === "cash") return "Efectivo";

  const info = item.bank_info || {};
  const name = String(info.name || item.bank || "").trim();
  const type = String(info.type || "").trim();
  const blob = `${name} ${type}`.toLowerCase();

  if (blob.includes("efectivo")) return "Efectivo";
  if (blob.includes("yape")) return "Yape";
  if (blob.includes("plin")) return "Plin";
  if (blob.includes("interbank")) return "Interbank";
  if (blob.includes("bcp")) return "Transferencia BCP";
  if (blob.includes("bbva")) return "Transferencia BBVA";
  if (blob.includes("scotiabank")) return "Transferencia Scotiabank";
  if (blob.includes("banbif")) return "Transferencia BanBif";

  if (name) {
    if (type && /transfer/i.test(type)) return `Transferencia ${name}`;
    return name;
  }
  if (item.pay_method === "bank") return "Transferencia";
  return null;
}

function buildPayMethodLabel(item, paymentSplit) {
  const parts = [];
  const paidSavings = Number(paymentSplit?.paid_savings || 0);
  const due = Number(paymentSplit?.due || 0);

  if (
    paidSavings > 0.0001 ||
    item.pay_method === "savings_bonus" ||
    due <= 0.0001
  ) {
    parts.push("Bono Ahorro");
  }

  const hasExternal =
    due > 0.0001 ||
    item.pay_method === "bank" ||
    item.pay_method === "credit-card" ||
    item.pay_method === "cash" ||
    !!item.bank_info ||
    !!(typeof item.voucher === "string" && item.voucher.trim()) ||
    !!(item.voucher && item.voucher.url) ||
    !!item.transaction_id;

  if (hasExternal) {
    const external = externalPayLabel(item);
    if (external) parts.push(external);
  }

  if (!parts.length) parts.push("Bono Ahorro");
  return parts.join(" + ");
}

function savingsPaymentSplit(item) {
  const price = Number(item.price) || 0;
  const pb = item.payment_breakdown;

  // Preferir breakdown explícito (incluye canjes mixtos con voucher)
  if (pb && !pb.legacy_missing_amounts) {
    return {
      paid_savings: Number(pb.paid_savings ?? pb.paid_balance ?? price),
      due: Number(pb.due || 0),
      mode: pb.mode || "savings_bonus_only",
      modeLabel: pb.modeLabel || "Bono Ahorro",
    };
  }

  // Canje 100% Bono Ahorro (sin pago externo)
  if (item.pay_method === "savings_bonus") {
    return {
      paid_savings: price,
      due: 0,
      mode: "savings_bonus_only",
      modeLabel: "Bono Ahorro",
    };
  }

  if (Array.isArray(item.amounts) && item.amounts.length >= 3) {
    const paidVirtual = Number(item.amounts[0] || 0);
    const paidBalance = Number(item.amounts[1] || 0);
    const due = Number(item.amounts[2] || 0);
    if (paidVirtual > 0 || paidBalance > 0 || due > 0) {
      return {
        paid_savings: paidVirtual + paidBalance,
        due,
        mode: due <= 0.0001 ? "savings_bonus_only" : "mixed",
        modeLabel: due <= 0.0001 ? "Bono Ahorro" : "Mixto",
      };
    }
  }

  if (item.order_type === SAVINGS_ORDER_TYPE) {
    return {
      paid_savings: price,
      due: 0,
      mode: "savings_bonus_only",
      modeLabel: "Bono Ahorro",
    };
  }

  return {
    paid_savings: price,
    due: 0,
    mode: "savings_bonus_only",
    modeLabel: "Bono Ahorro",
  };
}

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

async function refundSavingsBonusHold(redemption, reason) {
  // Solo devolver lo descontado del Bono Ahorro (no el cash del pedido mixto).
  const split = savingsPaymentSplit(redemption);
  let refundAmount = Number(split.paid_savings) || 0;

  if (Array.isArray(redemption.transactions) && redemption.transactions.length) {
    const txs =
      (await Transaction.find({
        id: { $in: redemption.transactions },
      })) || [];
    const held = txs
      .filter(
        (t) =>
          t.type === "out" &&
          (t.name === "savings_bonus_redemption" ||
            t.wallet_tipo === "BONO_AHORRO")
      )
      .reduce((sum, t) => sum + (Number(t.value) || 0), 0);
    const alreadyRefunded = txs
      .filter((t) => t.type === "in" && t.name === "savings_bonus_refund")
      .reduce((sum, t) => sum + (Number(t.value) || 0), 0);
    if (held > 0.0001) {
      refundAmount = Math.max(0, held - alreadyRefunded);
    } else if (alreadyRefunded > 0.0001) {
      refundAmount = 0;
    }
  }

  if (refundAmount <= 0.0001) return null;

  const refundId = rand();
  await Transaction.insert({
    id: refundId,
    date: new Date(),
    user_id: redemption.userId,
    type: "in",
    value: refundAmount,
    name: "savings_bonus_refund",
    desc: reason,
    virtual: false,
    wallet_tipo: "BONO_AHORRO",
    activation_id: redemption.id,
    period_key: redemption.period_key || null,
    period_label: redemption.period_label || null,
  });

  const transactions = Array.isArray(redemption.transactions)
    ? [...redemption.transactions, refundId]
    : [refundId];
  await Activation.update({ id: redemption.id }, { transactions });

  return refundId;
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
        const voucher = formatVoucherField(row.voucher);
        const voucher2 = row.voucher2
          ? formatVoucherField(row.voucher2)
          : null;
        const paymentSplit = savingsPaymentSplit(row);
        const payMethodLabel = buildPayMethodLabel(row, paymentSplit);

        return {
          ...row,
          ...u,
          officeName: officeMap[row.office] || row.office || "—",
          product: productsLabel(row.products),
          productsSummary: productsLabel(row.products),
          payMethodLabel,
          voucher,
          voucher2,
          paymentSplit,
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

      const price = Number(redemption.price) || 0;
      if (price <= 0) return res.json(error("invalid price"));

      const paymentSplit = savingsPaymentSplit(redemption);
      const deductSavings = Number(paymentSplit.paid_savings) || 0;

      const approvedAt = new Date();
      const resolvedPeriod = await resolvePeriodAtApproval(Period, approvedAt);
      const approvedPeriodKey = resolvedPeriod
        ? resolvedPeriod.key
        : redemption.period_key || null;
      const approvedPeriodLabel = resolvedPeriod
        ? resolvedPeriod.label
        : redemption.period_label || null;

      const hasHold =
        Array.isArray(redemption.transactions) &&
        redemption.transactions.length > 0;

      // Órdenes antiguas sin reserva: descontar al aprobar (compatibilidad)
      if (!hasHold) {
        if (deductSavings > 0.0001) {
          const userTx = await Transaction.find({
            user_id: user.id,
            virtual: { $in: [null, false] },
          });
          const savingsBalance = lib.calcSavingsBonusBalance(userTx);
          if (savingsBalance < deductSavings) {
            return res.json(
              error("Saldo Bono Ahorro insuficiente para aprobar el canje")
            );
          }
          const txId = rand();
          await Transaction.insert({
            id: txId,
            date: approvedAt,
            user_id: user.id,
            type: "out",
            value: deductSavings,
            name: "savings_bonus_redemption",
            desc: `Canje Bono Ahorro #${id}`,
            virtual: false,
            wallet_tipo: "BONO_AHORRO",
            activation_id: id,
            period_key: approvedPeriodKey,
            period_label: approvedPeriodLabel,
          });
          await Activation.update(
            { id },
            {
              status: "approved",
              approved_at: approvedAt,
              delivered: false,
              period_key: approvedPeriodKey,
              period_label: approvedPeriodLabel,
              transactions: [txId],
            }
          );
        } else {
          await Activation.update(
            { id },
            {
              status: "approved",
              approved_at: approvedAt,
              delivered: false,
              period_key: approvedPeriodKey,
              period_label: approvedPeriodLabel,
            }
          );
        }
      } else {
        await Activation.update(
          { id },
          {
            status: "approved",
            approved_at: approvedAt,
            delivered: false,
            period_key: approvedPeriodKey,
            period_label: approvedPeriodLabel,
          }
        );
        if (approvedPeriodKey && redemption.transactions?.length) {
          await syncOrderTransactionsPeriod(
            Transaction,
            redemption.transactions,
            approvedPeriodKey,
            approvedPeriodLabel
          );
        }
      }

      await deductOfficeStock(redemption.office, redemption.products);

      const userTxAfter = await Transaction.find({
        user_id: user.id,
        virtual: { $in: [null, false] },
      });

      await lib.createAuditLog(AuditLog, {
        collection: "activations",
        action: "approve_savings_bonus",
        target_id: id,
        user_id: user.id,
        admin_id: auth.user.id,
        state_after: {
          price,
          savingsBalance: lib.calcSavingsBonusBalance(userTxAfter),
          hadHold: hasHold,
        },
      });

      return res.json(success());
    }

    if (action === "reject") {
      const hasHold =
        Array.isArray(redemption.transactions) &&
        redemption.transactions.length > 0;
      if (hasHold) {
        await refundSavingsBonusHold(
          redemption,
          `Devolución canje rechazado #${id}`
        );
      }

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
      const wasPending = redemption.status === "pending";
      const hasHold =
        Array.isArray(redemption.transactions) &&
        redemption.transactions.length > 0;

      if ((wasPending || wasApproved) && hasHold) {
        await refundSavingsBonusHold(
          redemption,
          wasApproved
            ? `Devolución canje anulado (aprobado) #${id}`
            : `Devolución canje anulado (pendiente) #${id}`
        );
      }

      if (wasApproved) {
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
