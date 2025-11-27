import db from "../../../components/db";
import lib from "../../../components/lib";

const { Flyer } = db;
const { midd, success, rand } = lib;
const { applyCORS } = require("../../../middleware/middleware-cors");

export default async (req, res) => {
  // Aplicar CORS
  applyCORS(req, res);

  // Manejar preflight request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  await midd(req, res);

  if (req.method == "GET") {
    try {
      let flyers = await Flyer.find({});

      // response
      return res.json(
        success({
          flyers,
        })
      );
    } catch (error) {
      console.error("Error en GET /admin/flyers:", error);
      return res.status(500).json({ error: true, msg: error.message || "Error interno del servidor" });
    }
  }

  if (req.method == "POST") {
    try {
      const { action } = req.body;

      if (action == "edit") {
        const { id } = req.body;
        if (!id) {
          return res.json({ error: true, msg: "ID es requerido" });
        }

        const {
          name,
          image_url,
          base_image_url,
          active,
          description,
        } = req.body.data || {};

        if (!name || !base_image_url) {
          return res.json({ error: true, msg: "Nombre e imagen base son requeridos" });
        }

        await Flyer.update(
          { id },
          {
            name,
            image_url: image_url || "",
            base_image_url,
            active: active !== undefined ? active : true,
            description: description || "",
            updated_at: new Date(),
          }
        );
      } else if (action == "add") {
        const { name, image_url, base_image_url, active, description } =
          req.body.data || {};

        if (!name || !base_image_url) {
          return res.json({ error: true, msg: "Nombre e imagen base son requeridos" });
        }

        await Flyer.insert({
          id: rand(),
          name,
          image_url: image_url || "",
          base_image_url: base_image_url || "",
          active: active !== undefined ? active : true,
          description: description || "",
          created_at: new Date(),
          updated_at: new Date(),
        });
      } else if (action == "delete") {
        const { id } = req.body;
        if (!id) {
          return res.json({ error: true, msg: "ID es requerido" });
        }
        await Flyer.delete({ id });
      }

      // response
      return res.json(success({}));
    } catch (error) {
      console.error("Error en POST /admin/flyers:", error);
      return res.status(500).json({ error: true, msg: error.message || "Error interno del servidor" });
    }
  }

  if (req.method == "DELETE") {
    try {
      const { id } = req.body;
      if (!id) {
        return res.json({ error: true, msg: "ID es requerido" });
      }
      await Flyer.delete({ id });

      // response
      return res.json(
        success({
          message: "Flyer eliminado correctamente",
        })
      );
    } catch (error) {
      console.error("Error en DELETE /admin/flyers:", error);
      return res.status(500).json({ error: true, msg: error.message || "Error interno del servidor" });
    }
  }
};

