import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";
import {
  DEFAULT_POPUPS,
  POPUP_IDS,
  POPUP_TYPES,
  normalizeImagePopup,
  normalizeWelcomePopup,
} from "../../../lib/popupConfig";

const { DashboardConfig } = db;
const { success, error, midd } = lib;

async function loadPopup(type) {
  const saved = await DashboardConfig.findOne({ id: POPUP_IDS[type] });
  if (type === "welcome") {
    return normalizeWelcomePopup({ ...DEFAULT_POPUPS.welcome, ...(saved || {}) });
  }
  return normalizeImagePopup(type, { ...DEFAULT_POPUPS[type], ...(saved || {}) });
}

export default async (req, res) => {
  try {
    await midd(req, res);
    const auth = await requireAdmin(req, res);
    if (!auth) return;

    if (req.method === "GET") {
      const popups = {};
      for (const type of POPUP_TYPES) {
        popups[type] = await loadPopup(type);
      }
      return res.json(success({ popups }));
    }

    if (req.method === "POST") {
      const type = String((req.body && req.body.type) || "");
      if (!POPUP_TYPES.includes(type)) {
        return res.status(400).json(error("Tipo de pop-up no válido"));
      }

      const updatedAt = new Date();
      const payload = type === "welcome"
        ? normalizeWelcomePopup({ ...(req.body || {}), updatedAt })
        : normalizeImagePopup(type, { ...(req.body || {}), updatedAt });

      if (type !== "welcome" && payload.active && !payload.image) {
        return res.status(400).json(error("Sube una imagen antes de activar el pop-up"));
      }

      const existing = await DashboardConfig.findOne({ id: POPUP_IDS[type] });
      const doc = { id: POPUP_IDS[type], ...payload };
      if (existing) {
        await DashboardConfig.update({ id: POPUP_IDS[type] }, doc);
      } else {
        await DashboardConfig.insert(doc);
      }

      return res.json(success({
        popup: payload,
        message: "Pop-up guardado",
      }));
    }

    return res.status(405).json(error("Método no permitido"));
  } catch (err) {
    console.error("Error in /api/admin/popups:", err);
    return res.status(500).json(error(err.message));
  }
};
