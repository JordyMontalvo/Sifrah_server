import db from "../../../components/db";
import lib from "../../../components/lib";
import {
  DEFAULT_LEGAL_DOCUMENTS,
  DEFAULT_LEGAL_UPDATED,
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
    if (req.method !== "GET") {
      return res.status(405).json(error("Método no permitido"));
    }

    const key = String(req.query.doc || "");
    if (key && !DOCS.includes(key)) {
      return res.status(400).json(error("Documento no válido"));
    }

    if (key) {
      const document = await readLegalDocument(key);
      return res.json(success({ document }));
    }

    const documents = {};
    for (const item of DOCS) {
      documents[item] = await readLegalDocument(item);
    }
    return res.json(success({ documents }));
  } catch (err) {
    console.error("Error in /api/app/legal:", err);
    return res.status(500).json(error(err.message));
  }
};
