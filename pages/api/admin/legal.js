import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";
import {
  DEFAULT_LEGAL_DOCUMENTS,
  DEFAULT_LEGAL_UPDATED,
  legalTextLength,
  sanitizeLegalHtml,
} from "../../../lib/defaultLegalDocuments";

const { DashboardConfig } = db;
const { success, error, midd } = lib;

const DOCS = ["terms", "privacy"];

function docId(key) {
  return `legal_${key}`;
}

async function readLegalDocument(key) {
  const fallback = DEFAULT_LEGAL_DOCUMENTS[key];
  const saved = await DashboardConfig.findOne({ id: docId(key) });
  if (!saved || !saved.html) {
    return {
      key,
      title: fallback.title,
      html: fallback.html,
      updatedAt: DEFAULT_LEGAL_UPDATED,
      customized: false,
    };
  }
  return {
    key,
    title: fallback.title,
    html: sanitizeLegalHtml(saved.html),
    updatedAt: saved.updatedAt || DEFAULT_LEGAL_UPDATED,
    customized: true,
  };
}

export default async (req, res) => {
  try {
    await midd(req, res);
    const auth = await requireAdmin(req, res);
    if (!auth) return;

    if (req.method === "GET") {
      const documents = {};
      for (const key of DOCS) {
        documents[key] = await readLegalDocument(key);
      }
      return res.json(success({ documents }));
    }

    if (req.method === "POST") {
      const key = String((req.body && req.body.doc) || "");
      if (!DOCS.includes(key)) {
        return res.status(400).json(error("Documento no válido"));
      }

      const html = sanitizeLegalHtml(req.body && req.body.html);
      if (legalTextLength(html) < 20) {
        return res.status(400).json(error("El contenido está vacío o es demasiado corto"));
      }
      if (html.length > 100000) {
        return res.status(400).json(error("El contenido es demasiado largo"));
      }

      const existing = await DashboardConfig.findOne({ id: docId(key) });
      // Fecha de actualización elegida manualmente (YYYY-MM-DD); si no viene, se usa hoy
      const rawDate = String((req.body && req.body.updatedAt) || "").trim();
      let updatedAt = new Date();
      if (rawDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          return res.status(400).json(error("Fecha de actualización no válida"));
        }
        updatedAt = new Date(rawDate + "T12:00:00Z");
        if (isNaN(updatedAt.getTime())) {
          return res.status(400).json(error("Fecha de actualización no válida"));
        }
      }
      if (existing) {
        await DashboardConfig.update({ id: docId(key) }, { html, updatedAt });
      } else {
        await DashboardConfig.insert({
          id: docId(key),
          html,
          updatedAt,
        });
      }

      return res.json(success({
        document: {
          key,
          title: DEFAULT_LEGAL_DOCUMENTS[key].title,
          html,
          updatedAt,
          customized: true,
        },
        message: "Documento guardado",
      }));
    }

    return res.status(405).json(error("Método no permitido"));
  } catch (err) {
    console.error("Error in /api/admin/legal:", err);
    return res.status(500).json(error(err.message));
  }
};
