import db from "../../../components/db";
import lib from "../../../components/lib";
import { DEFAULT_UNIVERSITY_MODULES } from "../../../lib/defaultUniversityModules";
import {
  DEFAULT_UNIVERSITY_BANNERS,
  publicUniversityBanners,
} from "../../../lib/defaultUniversityBanners";

const { UniversityModule, UniversityHero } = db;
const HERO_DOC_ID = "main";
const { success, error, midd } = lib;

export default async (req, res) => {
  try {
    await midd(req, res);

    if (req.method === "GET") {
      let modules = await UniversityModule.find(
        { active: { $ne: false } },
        { sort: { order: 1 } }
      );

      // Si no hay módulos configurados aún, usamos o inicializamos los predeterminados
      if (!modules || modules.length === 0) {
        modules = DEFAULT_UNIVERSITY_MODULES;
      }

      let banners = DEFAULT_UNIVERSITY_BANNERS.map((slide) => ({ ...slide }));
      try {
        const hero = await UniversityHero.findOne({ id: HERO_DOC_ID });
        if (hero && Array.isArray(hero.banners)) {
          banners = publicUniversityBanners(hero.banners);
        }
      } catch (e) {
        banners = DEFAULT_UNIVERSITY_BANNERS.map((slide) => ({ ...slide }));
      }

      return res.json(success({ modules, banners }));
    }

    return res.status(405).json(error("Método no permitido"));
  } catch (err) {
    console.error("Error in /api/app/university:", err);
    return res.status(500).json(error(err.message));
  }
};
