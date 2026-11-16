import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

const { complaintView } = require("../../../lib/complaints");

const { Complaint } = db;
const { error, success, midd } = lib;

/**
 * Libro de Reclamaciones en el administrador (solo lectura por ahora).
 *
 * GET /api/admin/complaints        -> lista de registros, del más reciente al más antiguo
 * GET /api/admin/complaints?id=XX  -> un registro
 */
export default async function handler(req, res) {
  await midd(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.json(error("method not allowed"));
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const id = String((req.query && req.query.id) || "").trim();
  if (id) {
    const record = await Complaint.findOne({ id });
    if (!record) return res.json(error("Registro no encontrado"));
    return res.json(success({ complaint: complaintView(record) }));
  }

  const found = await Complaint.find({}, { sort: { number: -1 } });
  const complaints = (Array.isArray(found) ? found : []).map(complaintView);

  const summary = {
    total: complaints.length,
    reclamos: complaints.filter((c) => c.detail.kind === "reclamo").length,
    quejas: complaints.filter((c) => c.detail.kind === "queja").length,
  };

  return res.json(success({ complaints, summary }));
}
