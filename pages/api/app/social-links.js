import db from "../../../components/db";
import lib from "../../../components/lib";
import { getSocialLinks } from "../../../components/social-links";

const { DashboardConfig } = db;
const { success, error, midd } = lib;

export default async (req, res) => {
  await midd(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    try {
      const links = await getSocialLinks(DashboardConfig);
      res.setHeader("Cache-Control", "no-store");
      return res.json(success({ links }));
    } catch (err) {
      return res.status(500).json(error(err.message || "Error al cargar los enlaces"));
    }
  }

  return res.status(405).json(error("Método no permitido"));
};
