import db from "../../../components/db";
import lib from "../../../components/lib";

const { User, Transaction } = db;
const { midd, success, error } = lib;

const CLOSURE_BONUS_NAMES = ["residual bonus", "closed bonus"];

function normalizeText(v) {
  return (v || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default async (req, res) => {
  await midd(req, res);

  if (req.method !== "GET") return res.json(error("invalid method"));

  const { page = 1, limit = 20, search = "" } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.max(parseInt(limit, 10) || 20, 1);
  const q = normalizeText(search);
  try {
    const users = await User.find({});
    const txs = await Transaction.find({ name: { $in: CLOSURE_BONUS_NAMES }, type: "in" });

    const txByUser = new Map();
    for (const tx of txs) {
      if (!txByUser.has(tx.user_id)) txByUser.set(tx.user_id, []);
      txByUser.get(tx.user_id).push(tx);
    }

    const rows = users.map((u) => {
      const userTxs = txByUser.get(u.id) || [];
      const rankHistory = Array.isArray(u.rank_history) ? u.rank_history : [];
      const closureBonusTotal = userTxs.reduce((acc, t) => acc + Number(t.value || 0), 0);
      const closureBonusCount = userTxs.length;

      return {
        id: u.id,
        name: u.name || "",
        lastName: u.lastName || "",
        dni: u.dni || "",
        rank: u.rank || "none",
        rank_history: rankHistory,
        rank_history_count: rankHistory.length,
        closure_bonus_total: closureBonusTotal,
        closure_bonus_count: closureBonusCount,
        closure_bonus_last_date: userTxs.length
          ? userTxs.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date
          : null,
      };
    });

    const filtered = rows.filter((r) => {
      if (!q) return true;
      const fullName = `${r.name} ${r.lastName}`.trim();
      return (
        normalizeText(fullName).includes(q) ||
        normalizeText(r.dni).includes(q) ||
        normalizeText(r.id).includes(q)
      );
    });

    filtered.sort((a, b) => {
      if (b.closure_bonus_total !== a.closure_bonus_total) {
        return b.closure_bonus_total - a.closure_bonus_total;
      }
      return b.rank_history_count - a.rank_history_count;
    });

    const total = filtered.length;
    const totalPages = Math.max(Math.ceil(total / limitNum), 1);
    const start = (pageNum - 1) * limitNum;
    const items = filtered.slice(start, start + limitNum);

    return res.json(
      success({
        items,
        total,
        totalPages,
        currentPage: pageNum,
      })
    );
  } catch (e) {
    console.error("Error loading rank history summary:", e);
    return res.status(500).json(error("database error"));
  }
};

