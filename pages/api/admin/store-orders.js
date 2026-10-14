import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

const { Activation, User } = db;
const { error, success } = lib;

function sellerName(user) {
  if (!user) return "";
  return [user.name, user.lastName].filter(Boolean).join(" ").trim();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.json(error("method not allowed"));
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const found = await Activation.find({ channel: "shared_store" });
  const orders = Array.isArray(found) ? found : [];
  orders.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const sellerIds = [...new Set(orders.map((order) => order.userId).filter(Boolean))];
  const sellers = sellerIds.length ? await User.find({ id: { $in: sellerIds } }) : [];
  const sellerById = new Map((sellers || []).map((user) => [String(user.id), user]));

  const rows = orders.map((order) => {
    const seller = sellerById.get(String(order.userId));
    const buyer = order.buyer && typeof order.buyer === "object" ? order.buyer : {};
    const products = Array.isArray(order.products) ? order.products : [];
    const productText =
      products
        .filter((product) => Number(product.total) > 0)
        .map((product) => `${product.total} ${product.name || "Producto"}`)
        .join(", ") || "-";

    const points =
      Number(order.points) ||
      products.reduce(
        (sum, p) => sum + (Number(p.points) || 0) * (Number(p.total) || 1),
        0
      );

    return {
      id: order.id,
      date: order.date,
      buyer: {
        name: buyer.name || "Sin nombre",
        document: buyer.document || "",
        phone: buyer.phone || "",
        email: buyer.email || "",
      },
      seller: {
        name: sellerName(seller) || "Socio no encontrado",
        dni: seller && seller.dni ? seller.dni : "",
        id: order.userId || "",
      },
      products: productText,
      points,
      amount: Number(order.price) || 0,
      status: order.status || "pending",
      pay_method: order.pay_method || "",
      delivered: order.delivered === true,
      bank: order.bank || "",
      voucher: order.voucher || "",
      voucher_number: order.voucher_number || "",
      address:
        (order.delivery_info && order.delivery_info.delivery_address) || "",
    };
  });

  const summary = {
    total: rows.length,
    pending: rows.filter((row) => row.status === "pending").length,
    approved: rows.filter((row) => row.status === "approved").length,
    amount: rows
      .filter((row) => row.status !== "rejected" && row.status !== "cancelled")
      .reduce((sum, row) => sum + row.amount, 0),
    points: rows
      .filter((row) => row.status !== "rejected" && row.status !== "cancelled")
      .reduce((sum, row) => sum + (row.points || 0), 0),
  };

  return res.json(success({ orders: rows, summary }));
}
