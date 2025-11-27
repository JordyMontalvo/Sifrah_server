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
    let flyers = await Flyer.find({});

    // response
    return res.json(
      success({
        flyers,
      })
    );
  }

  if (req.method == "POST") {
    const { action } = req.body;

    if (action == "edit") {
      const { id } = req.body;
      const {
        name,
        image_url,
        base_image_url,
        active,
        description,
      } = req.body.data;

      await Flyer.update(
        { id },
        {
          $set: {
            name,
            image_url,
            base_image_url,
            active: active !== undefined ? active : true,
            description: description || "",
            updated_at: new Date(),
          },
        }
      );
    }

    if (action == "add") {
      const { name, image_url, base_image_url, active, description } =
        req.body.data;

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
    }

    if (action == "delete") {
      const { id } = req.body;
      await Flyer.delete({ id });
    }

    // response
    return res.json(success({}));
  }

  if (req.method == "DELETE") {
    const { id } = req.body;
    await Flyer.delete({ id });

    // response
    return res.json(
      success({
        message: "Flyer eliminado correctamente",
      })
    );
  }
};

