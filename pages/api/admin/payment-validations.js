import db from "../../../components/db";
import lib from "../../../components/lib";

const { Activation, Affiliation, User } = db;
const { error, success, midd, map, model } = lib;

const USER_MODEL = ["name", "lastName", "dni", "phone"];

const AFF_MODEL = [
  "id",
  "date",
  "userId",
  "plan",
  "voucher",
  "voucher2",
  "status",
  "office",
  "pay_method",
  "bank",
  "voucher_date",
  "voucher_number",
  "amounts",
  "use_balance",
  "period_key",
  "period_label",
  "approved_at",
  "type",
];

const ACT_MODEL = [
  "id",
  "date",
  "userId",
  "price",
  "points",
  "voucher",
  "voucher2",
  "status",
  "office",
  "pay_method",
  "bank",
  "voucher_date",
  "voucher_number",
  "amounts",
  "period_key",
  "period_label",
  "approved_at",
];

function buildPaymentBreakdown({ amounts, total, use_balance }) {
  const hasAmounts = Array.isArray(amounts) && amounts.length >= 3;
  const paid_virtual = hasAmounts ? Number(amounts[0] || 0) : 0;
  const paid_balance = hasAmounts ? Number(amounts[1] || 0) : 0;
  let due = hasAmounts ? Number(amounts[2] || 0) : 0;

  let legacy_missing_amounts = false;
  if (!hasAmounts) {
    if (use_balance === true) {
      // Marcó saldo, pero no quedó guardado el detalle (histórico)
      legacy_missing_amounts = true;
      due = 0;
    } else {
      // Si no usó saldo y no hay detalle, asumir todo por método externo
      due = Number(total || 0);
    }
  }

  let mode = "external_only";
  if (use_balance === true || (hasAmounts && (paid_virtual > 0 || paid_balance > 0))) {
    mode = due <= 0.0001 ? "balance_only" : "mixed";
  }

  return {
    total: Number(total || 0),
    paid_virtual,
    paid_balance,
    due,
    mode,
    legacy_missing_amounts,
    use_balance: !!use_balance,
  };
}

export default async (req, res) => {
  await midd(req, res);

  if (req.method !== "GET") return res.json(error("invalid method"));

  const { filter = "pending", kind = "all" } = req.query;
  const validFilters = ["all", "pending", "approved", "rejected", "cancelled"];
  if (!validFilters.includes(filter)) return res.json(error("invalid filter"));
  const validKinds = ["all", "affiliation", "activation"];
  if (!validKinds.includes(kind)) return res.json(error("invalid kind"));

  const baseQ = filter === "all" ? {} : { status: filter };

  // Solo items que tengan intención de pago bancario o tengan comprobante
  const voucherQ = {
    ...baseQ,
    $or: [
      { pay_method: "bank" },
      { voucher: { $exists: true, $ne: null, $ne: "" } },
      { voucher_number: { $exists: true, $ne: "" } }
    ]
  };

  let affs = [];
  let acts = [];

  if (kind === "all" || kind === "affiliation") {
    const raw = await Affiliation.find(voucherQ);
    affs = (raw || []).map((a) => {
      const x = model(a, AFF_MODEL);
      const total = x.plan && x.plan.amount != null ? Number(x.plan.amount) : 0;
      const payment_breakdown = buildPaymentBreakdown({
        amounts: x.amounts,
        total,
        use_balance: x.use_balance,
      });
      return {
        kind: "affiliation",
        ...x,
        total,
        payment_breakdown,
      };
    });
  }

  if (kind === "all" || kind === "activation") {
    const raw = await Activation.find(voucherQ);
    acts = (raw || []).map((a) => {
      const x = model(a, ACT_MODEL);
      const total = x.price != null ? Number(x.price) : 0;
      const payment_breakdown = buildPaymentBreakdown({
        amounts: x.amounts,
        total,
        use_balance: false,
      });
      return {
        kind: "activation",
        ...x,
        total,
        payment_breakdown,
      };
    });
  }

  const items = [...affs, ...acts].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Enriquecer usuarios
  const userIds = items.map((i) => i.userId).filter(Boolean);
  const usersRaw = await User.find({ id: { $in: userIds } });
  const users = map(usersRaw || []);

  const enriched = items.map((i) => {
    const u = users.get(i.userId);
    return {
      ...i,
      user: u ? model(u, USER_MODEL) : null,
    };
  });

  // --- CHEQUEO DE DUPLICADOS EN BASE DE DATOS ---
  const voucherNumbers = enriched
    .map((i) => String(i.voucher_number || "").trim())
    .filter((v) => v.length > 3); // Solo voucher numbers con longitud razonable

  let globalDuplicates = new Set();
  if (voucherNumbers.length > 0) {
    const qDuplicated = {
      voucher_number: { $in: voucherNumbers },
      status: { $in: ["approved", "pending"] },
    };

    const [dupAffs, dupActs] = await Promise.all([
      Affiliation.find(qDuplicated),
      Activation.find(qDuplicated),
    ]);

    // Contar ocurrencias globales por voucher_number
    const counts = {};
    [...dupAffs, ...dupActs].forEach((d) => {
      const vn = String(d.voucher_number || "").trim();
      counts[vn] = (counts[vn] || 0) + 1;
    });

    // Marcar como duplicado si aparece más de una vez en total en la DB
    // O si aparece al menos una vez y es un approved previo.
    // Pero aquí simplificamos: si aparece más de una vez sumando pending + approved, es riesgo.
    Object.keys(counts).forEach((vn) => {
      if (counts[vn] > 1) globalDuplicates.add(vn);
    });
  }

  const finalized = enriched.map((i) => {
    const vn = String(i.voucher_number || "").trim();
    return {
      ...i,
      possibleDuplicate: vn ? globalDuplicates.has(vn) : false,
    };
  });

  return res.json(
    success({
      items: finalized,
      total: finalized.length,
    })
  );
};

