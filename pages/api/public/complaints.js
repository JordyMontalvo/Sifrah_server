import db from "../../../components/db";
import lib from "../../../components/lib";
import { consumir } from "../../../components/rate-limit";

const { getClientIp } = require("../../../components/client-ip");
const {
  COMPANY,
  validateComplaint,
  formatComplaintNumber,
  complaintView,
} = require("../../../lib/complaints");

const { Complaint, Counter } = db;
const { error, success, midd, rand } = lib;

// Holgado a propósito (varias personas pueden compartir IP desde el móvil);
// solo evita que alguien registre reclamos sin fin.
const MAX_REGISTROS = 10;
const VENTANA_MS = 10 * 60 * 1000;

/**
 * Siguiente n.º correlativo del Libro de Reclamaciones.
 * $inc en un único documento es atómico: dos envíos simultáneos nunca reciben
 * el mismo número. findOneAndUpdate devuelve el documento previo (o null la
 * primera vez), así que el número asignado es el valor anterior + 1.
 */
async function nextComplaintNumber() {
  const previous = await Counter.findOneAndUpdate(
    { _id: "complaints" },
    { $inc: { seq: 1 } },
    { upsert: true }
  );
  return ((previous && Number(previous.seq)) || 0) + 1;
}

/**
 * Libro de Reclamaciones virtual (público, sin sesión).
 *
 * GET  /api/public/complaints  -> datos de la empresa para el encabezado
 * POST /api/public/complaints  -> registra un reclamo o queja
 */
export default async (req, res) => {
  await midd(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.json(success({ company: COMPANY }));
  }

  if (req.method !== "POST") return res.status(405).json(error("Método no permitido"));

  const esperar = consumir(`complaints:${getClientIp(req)}`, {
    maximo: MAX_REGISTROS,
    ventanaMs: VENTANA_MS,
  });
  if (esperar) {
    res.setHeader("Retry-After", String(esperar));
    return res
      .status(429)
      .json(error("Has enviado varios registros seguidos. Intenta nuevamente en unos minutos."));
  }

  const { errors, data } = validateComplaint(req.body || {});
  const fields = Object.keys(errors);
  if (fields.length) {
    return res.json({ ...error(errors[fields[0]]), fields: errors });
  }

  // Doble clic o reintento de red: el mismo envío devuelve el registro ya creado
  if (data.client_request_id) {
    const existing = await Complaint.findOne({ client_request_id: data.client_request_id });
    if (existing) return res.json(success({ complaint: complaintView(existing), duplicate: true }));
  }

  const number = await nextComplaintNumber();
  const record = {
    id: rand(),
    number,
    code: formatComplaintNumber(number),
    created_at: new Date(),
    status: "nuevo",
    company: COMPANY,
    consumer: data.consumer,
    product: data.product,
    detail: data.detail,
    client_request_id: data.client_request_id,
    email_sent: false,
  };
  await Complaint.insert(record);

  const view = complaintView(record);

  // Copia al correo del consumidor, si lo dio. Un fallo de correo no anula el registro.
  if (view.consumer.email) {
    try {
      const emailService = require("../../../components/email-service");
      await emailService.sendComplaintCopyEmail(view);
      await Complaint.update({ id: record.id }, { email_sent: true });
      view.email_sent = true;
    } catch (err) {
      console.error("[complaints] no se pudo enviar la copia por correo:", err && err.message);
    }
  }

  return res.json(success({ complaint: view }));
};
