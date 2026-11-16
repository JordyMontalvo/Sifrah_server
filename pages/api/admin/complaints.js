import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

const { complaintView, validateComplaintUpdate, STATUSES } = require("../../../lib/complaints");

const { Complaint, AuditLog } = db;
const { error, success, midd } = lib;

/**
 * Libro de Reclamaciones en el administrador.
 *
 * GET  /api/admin/complaints        -> lista de registros, del más reciente al más antiguo
 * GET  /api/admin/complaints?id=XX  -> un registro
 * POST /api/admin/complaints        -> { action: "update", id, status, response, notify }
 *      Cambia el estado y guarda la respuesta dada al consumidor. Con `notify`,
 *      la respuesta se envía también a su correo (si dejó uno).
 */
export default async function handler(req, res) {
  await midd(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    return res.json(error("method not allowed"));
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method === "POST") {
    const body = req.body || {};
    if (body.action !== "update") return res.json(error("Acción no válida"));

    const id = String(body.id || "").trim();
    const record = id ? await Complaint.findOne({ id }) : null;
    if (!record) return res.json(error("Registro no encontrado"));

    const { errors, data } = validateComplaintUpdate(body);
    const fields = Object.keys(errors);
    if (fields.length) return res.json({ ...error(errors[fields[0]]), fields: errors });

    const now = new Date();
    const previousStatus = complaintView(record).status;
    const update = { status: data.status, status_updated_at: now };
    if (data.response) {
      update.response = {
        text: data.response,
        updated_at: now,
        admin_id: auth.user && auth.user.id,
        email_sent: false,
      };
    }
    await Complaint.update({ id }, update);

    let view = complaintView({ ...record, ...update });

    if (data.notify && data.response && view.consumer.email) {
      try {
        const emailService = require("../../../components/email-service");
        await emailService.sendComplaintResponseEmail(view);
        update.response.email_sent = true;
        await Complaint.update({ id }, { response: update.response });
        view = complaintView({ ...record, ...update });
      } catch (err) {
        console.error("[complaints] no se pudo enviar la respuesta por correo:", err && err.message);
      }
    }

    await lib.createAuditLog(AuditLog, {
      collection: "complaints",
      action: "update",
      target_id: id,
      admin_id: auth.user && auth.user.id,
      state_before: { status: previousStatus },
      state_after: { status: data.status, responded: !!data.response, email_sent: !!(view.response && view.response.email_sent) },
    });

    return res.json(success({ complaint: view }));
  }

  const id = String((req.query && req.query.id) || "").trim();
  if (id) {
    const record = await Complaint.findOne({ id });
    if (!record) return res.json(error("Registro no encontrado"));
    return res.json(success({ complaint: complaintView(record) }));
  }

  const found = await Complaint.find({}, { sort: { number: -1 } });
  const complaints = (Array.isArray(found) ? found : []).map(complaintView);

  const byStatus = {};
  Object.keys(STATUSES).forEach((s) => {
    byStatus[s] = complaints.filter((c) => c.status === s).length;
  });

  const summary = {
    total: complaints.length,
    reclamos: complaints.filter((c) => c.detail.kind === "reclamo").length,
    quejas: complaints.filter((c) => c.detail.kind === "queja").length,
    by_status: byStatus,
  };

  return res.json(success({ complaints, summary }));
}
