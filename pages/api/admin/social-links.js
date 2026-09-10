import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";
import {
  SOCIAL_LINKS_ID,
  formatSocialLinks,
  getSocialLinks,
  normalizeUrl,
  normalizeWhatsApp,
} from "../../../components/social-links";

const { DashboardConfig } = db;
const { success, error, midd } = lib;

export default async (req, res) => {
  await midd(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    try {
      const links = await getSocialLinks(DashboardConfig);
      res.setHeader("Cache-Control", "no-store");
      return res.json(success({ links }));
    } catch (err) {
      return res.status(500).json(error(err.message || "Error al cargar los enlaces"));
    }
  }

  if (req.method === "POST") {
    try {
      const body = req.body || {};
      const links = formatSocialLinks({
        facebook: normalizeUrl(body.facebook),
        youtube: normalizeUrl(body.youtube),
        tiktok: normalizeUrl(body.tiktok),
        whatsapp: normalizeWhatsApp(body.whatsapp),
      });

      const existing = await DashboardConfig.findOne({ id: SOCIAL_LINKS_ID });
      const payload = {
        ...links,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await DashboardConfig.update({ _id: existing._id }, payload);
      } else {
        await DashboardConfig.insert({ id: SOCIAL_LINKS_ID, ...payload });
      }

      return res.json(success({
        message: "Enlaces actualizados",
        links,
      }));
    } catch (err) {
      return res.status(500).json(error(err.message || "Error al guardar los enlaces"));
    }
  }

  return res.status(405).json(error("Método no permitido"));
};
