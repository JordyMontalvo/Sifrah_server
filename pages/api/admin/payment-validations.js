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

  if (req.method === "POST") {
    const { action, id, kind } = req.body;
    const Coll = kind === "affiliation" ? Affiliation : Activation;

    if (!id || !kind) return res.json(error("missing params"));

    if (action === "approve") {
      // Establecer como 'verified' en lugar de 'approved' para el flujo de 2 pasos
      const result = await Coll.update({ id }, { status: "verified", verifiedAt: new Date() });
      return res.json(success({ action: "verified" }));
    }

    if (action === "reject") {
      await Coll.update({ id }, { status: "rejected" });
      return res.json(success({ action: "rejected" }));
    }

    return res.json(error("invalid action"));
  }
  if (req.method === "GET") {
    const { filter = "pending", kind = "all" } = req.query;
    console.log(`[Payment Validations] GET request - filter: ${filter}, kind: ${kind}`);

    try {
      // Intentar traer los datos de manera individual para capturar errores
      let affsRaw = [];
      let actsRaw = [];
      
      try {
        if (kind === "all" || kind === "affiliation") {
          affsRaw = await Affiliation.find({}) || [];
        }
      } catch (e1) { console.error("Error fetching affs:", e1); }

      try {
        if (kind === "all" || kind === "activation") {
          actsRaw = await Activation.find({}) || [];
        }
      } catch (e2) { console.error("Error fetching acts:", e2); }

      // Filtrar por voucher en JS para máxima seguridad
      const hasVoucher = (x) => !!(x.voucher || x.voucher2 || x.voucher_number);

      const mappedAffs = affsRaw.filter(hasVoucher).map(a => {
        const x = model(a, AFF_MODEL);
        const total = x.plan && x.plan.amount != null ? Number(x.plan.amount) : 0;
        return {
          ...x,
          kind: "affiliation",
          total,
          payment_breakdown: buildPaymentBreakdown({ amounts: x.amounts, total, use_balance: x.use_balance }),
          date: x.date || new Date().toISOString()
        };
      });

      const mappedActs = actsRaw.filter(hasVoucher).map(a => {
        const x = model(a, ACT_MODEL);
        const total = x.price != null ? Number(x.price) : 0;
        return {
          ...x,
          kind: "activation",
          total,
          payment_breakdown: buildPaymentBreakdown({ amounts: x.amounts, total, use_balance: false }),
          date: x.date || new Date().toISOString()
        };
      });

      let items = [...mappedAffs, ...mappedActs];
      
      // Filtrar por status
      if (filter !== "all") {
        items = items.filter(i => i.status === filter);
      }

      // Enriquecer usuarios de forma segura
      try {
        const userIds = [...new Set(items.map(i => i.userId).filter(Boolean))];
        if (userIds.length > 0) {
          const usersRaw = await User.find({ id: { $in: userIds } }) || [];
          const userMap = new Map((usersRaw || []).map(u => [u.id, u]));
          items = items.map(i => {
            const u = userMap.get(i.userId);
            return {
              ...i,
              user: {
                name: u ? u.name : "N/A",
                lastName: u ? u.lastName : "",
                dni: u ? u.dni : "-",
              }
            };
          });
        } else {
          items = items.map(i => ({ ...i, user: { name: "N/A", lastName: "", dni: "-" } }));
        }
      } catch (ue) {
        console.error("Error enriching users:", ue);
        items = items.map(i => ({ ...i, user: { name: "N/A", lastName: "", dni: "-" } }));
      }

      items.sort((a, b) => new Date(b.date) - new Date(a.date));

      return res.status(200).json({ items });
    } catch (err) {
      console.error("[Payment Validations] GET General Error:", err);
      return res.status(500).json(error(err.message));
    }
  }

  return res.json(error("invalid method"));
};
