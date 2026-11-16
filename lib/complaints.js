/**
 * Libro de Reclamaciones: validación y formato de los registros.
 *
 * Se mantiene sin dependencias de base de datos para poder probarlo aislado.
 * El endpoint público (pages/api/public/complaints.js) y el del administrador
 * (pages/api/admin/complaints.js) usan estas funciones.
 */

const COMPANY = {
  name: "SIFRAH CORP S.A.C.",
  ruc: "20612589454",
  address: "Calle Loma Real 262, Santiago de Surco, Lima.",
};

const DOC_TYPES = {
  dni: { label: "DNI", pattern: /^\d{8}$/, hint: "El DNI debe tener 8 dígitos." },
  ce: {
    label: "Carné de extranjería",
    pattern: /^[A-Za-z0-9]{6,12}$/,
    hint: "El carné de extranjería debe tener entre 6 y 12 caracteres alfanuméricos.",
  },
  cedula: {
    label: "Cédula",
    pattern: /^[A-Za-z0-9-]{5,15}$/,
    hint: "La cédula debe tener entre 5 y 15 caracteres.",
  },
  pasaporte: {
    label: "Pasaporte",
    pattern: /^[A-Za-z0-9]{6,12}$/,
    hint: "El pasaporte debe tener entre 6 y 12 caracteres alfanuméricos.",
  },
};

const OPERATION_TYPES = {
  afiliacion: "Afiliación",
  recompra: "Recompra (Reconsumo)",
};

const KINDS = {
  reclamo: "Reclamo",
  queja: "Queja",
};

const LIMITS = {
  description: 500,
  request: 300,
  response: 2000,
};

// Estados de seguimiento en el administrador
const STATUSES = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  atendido: "Atendido",
};

/** Estado normalizado: los registros antiguos ("nuevo") cuentan como pendientes. */
function normalizeStatus(status) {
  return STATUSES[status] ? status : "pendiente";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{6,15}$/;

function text(value, max) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function longText(value) {
  // Conserva saltos de línea en los textos amplios, sin espacios sobrantes
  return String(value == null ? "" : value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Correo o teléfono en un mismo campo: decide cuál es. */
function parseContact(value) {
  const raw = text(value, 120);
  if (!raw) return null;
  if (EMAIL_RE.test(raw)) return { type: "email", value: raw.toLowerCase() };
  const phone = raw.replace(/[\s().-]/g, "");
  if (PHONE_RE.test(phone)) return { type: "phone", value: phone };
  return null;
}

/** Monto opcional en soles: null si está vacío, número con 2 decimales si es válido. */
function parseAmount(value) {
  if (value == null || String(value).trim() === "") return { value: null };
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 1000000) {
    return { error: "El monto debe ser un número válido mayor o igual a 0." };
  }
  return { value: Math.round(n * 100) / 100 };
}

/**
 * Valida y normaliza el formulario. Devuelve { errors, data }:
 * `errors` es un objeto campo -> mensaje (vacío si todo está bien).
 */
function validateComplaint(body = {}) {
  const errors = {};
  const required = (field, value, msg) => {
    if (!value) errors[field] = msg;
    return value;
  };

  const names = required("names", text(body.names, 80), "Escribe tus nombres.");
  const lastNameFather = required(
    "last_name_father",
    text(body.last_name_father, 60),
    "Escribe tu apellido paterno."
  );
  const lastNameMother = required(
    "last_name_mother",
    text(body.last_name_mother, 60),
    "Escribe tu apellido materno."
  );

  const isMinor = body.is_minor === true || body.is_minor === "true";
  const guardian = text(body.guardian, 120);
  if (isMinor && guardian.length < 3) {
    errors.guardian = "Escribe el nombre y apellido del padre, madre o representante.";
  }

  const address = required("address", text(body.address, 200), "Escribe tu domicilio.");

  const docType = text(body.doc_type, 20).toLowerCase();
  const docNumber = text(body.doc_number, 20).replace(/\s/g, "");
  if (!DOC_TYPES[docType]) {
    errors.doc_type = "Selecciona un tipo de documento.";
  } else if (!docNumber) {
    errors.doc_number = "Escribe el número de documento.";
  } else if (!DOC_TYPES[docType].pattern.test(docNumber)) {
    errors.doc_number = DOC_TYPES[docType].hint;
  }

  const contactRaw = text(body.contact, 120);
  const contact = parseContact(contactRaw);
  if (!contactRaw) errors.contact = "Escribe tu correo electrónico o número de teléfono.";
  else if (!contact) errors.contact = "Escribe un correo válido o un teléfono de 6 a 15 dígitos.";

  const operationType = text(body.operation_type, 20).toLowerCase();
  if (!OPERATION_TYPES[operationType]) errors.operation_type = "Selecciona el tipo de operación.";

  const products = required("products", text(body.products, 300), "Escribe el producto o productos relacionados.");

  const amount = parseAmount(body.amount);
  if (amount.error) errors.amount = amount.error;

  const kind = text(body.kind, 10).toLowerCase();
  if (!KINDS[kind]) errors.kind = "Selecciona si es un reclamo o una queja.";

  const description = longText(body.description);
  if (!description) errors.description = "Describe lo sucedido.";
  else if (description.length > LIMITS.description) {
    errors.description = `La descripción no puede superar ${LIMITS.description} caracteres.`;
  }

  const request = longText(body.request);
  if (!request) errors.request = "Indica la solución que esperas.";
  else if (request.length > LIMITS.request) {
    errors.request = `La solicitud no puede superar ${LIMITS.request} caracteres.`;
  }

  const clientRequestId = text(body.client_request_id, 64);
  const safeRequestId = /^[A-Za-z0-9-]{8,64}$/.test(clientRequestId) ? clientRequestId : null;

  return {
    errors,
    data: {
      consumer: {
        names,
        last_name_father: lastNameFather,
        last_name_mother: lastNameMother,
        is_minor: isMinor,
        guardian: isMinor ? guardian : "",
        address,
        doc_type: docType,
        doc_number: docType === "dni" ? docNumber : docNumber.toUpperCase(),
        contact_type: contact ? contact.type : null,
        email: contact && contact.type === "email" ? contact.value : "",
        phone: contact && contact.type === "phone" ? contact.value : "",
      },
      product: {
        operation_type: operationType,
        products,
        amount: amount.value == null ? null : amount.value,
      },
      detail: { kind, description, request },
      client_request_id: safeRequestId,
    },
  };
}

/**
 * Cambio de estado / respuesta desde el administrador.
 * Para marcar "Atendido" se exige la respuesta dada al consumidor.
 */
function validateComplaintUpdate(body = {}) {
  const errors = {};
  const status = text(body.status, 20).toLowerCase();
  if (!STATUSES[status]) errors.status = "Selecciona un estado válido.";

  const response = longText(body.response);
  if (response.length > LIMITS.response) {
    errors.response = `La respuesta no puede superar ${LIMITS.response} caracteres.`;
  } else if (status === "atendido" && !response) {
    errors.response = "Escribe la respuesta dada al consumidor para marcarlo como atendido.";
  }

  return {
    errors,
    data: {
      status,
      response,
      notify: body.notify === true || body.notify === "true",
    },
  };
}

/** N.º de registro con 4 dígitos como mínimo: 1 -> "0001". */
function formatComplaintNumber(n) {
  return String(Math.max(0, Number(n) || 0)).padStart(4, "0");
}

/** Lo que se devuelve al consumidor y al administrador (sin datos internos). */
function complaintView(record) {
  if (!record) return null;
  const c = record.consumer || {};
  const p = record.product || {};
  const d = record.detail || {};
  const r = record.response || null;
  const status = normalizeStatus(record.status);
  return {
    id: record.id,
    number: record.number,
    code: record.code || formatComplaintNumber(record.number),
    created_at: record.created_at,
    status,
    status_label: STATUSES[status],
    status_updated_at: record.status_updated_at || null,
    response:
      r && r.text
        ? { text: r.text, updated_at: r.updated_at || null, email_sent: r.email_sent === true }
        : null,
    company: record.company || COMPANY,
    consumer: {
      names: c.names || "",
      last_name_father: c.last_name_father || "",
      last_name_mother: c.last_name_mother || "",
      full_name: [c.names, c.last_name_father, c.last_name_mother].filter(Boolean).join(" "),
      is_minor: !!c.is_minor,
      guardian: c.guardian || "",
      address: c.address || "",
      doc_type: c.doc_type || "",
      doc_type_label: (DOC_TYPES[c.doc_type] && DOC_TYPES[c.doc_type].label) || c.doc_type || "",
      doc_number: c.doc_number || "",
      contact_type: c.contact_type || null,
      email: c.email || "",
      phone: c.phone || "",
    },
    product: {
      operation_type: p.operation_type || "",
      operation_type_label: OPERATION_TYPES[p.operation_type] || p.operation_type || "",
      products: p.products || "",
      amount: p.amount == null ? null : Number(p.amount),
    },
    detail: {
      kind: d.kind || "",
      kind_label: KINDS[d.kind] || d.kind || "",
      description: d.description || "",
      request: d.request || "",
    },
    email_sent: record.email_sent === true,
  };
}

module.exports = {
  COMPANY,
  DOC_TYPES,
  OPERATION_TYPES,
  KINDS,
  LIMITS,
  STATUSES,
  normalizeStatus,
  validateComplaint,
  validateComplaintUpdate,
  parseContact,
  parseAmount,
  formatComplaintNumber,
  complaintView,
};
