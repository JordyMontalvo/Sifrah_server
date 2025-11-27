import db from "../../../components/db";
import lib from "../../../components/lib";

const { Flyer, Session } = db;
const { midd, success, error } = lib;

export default async (req, res) => {
  await midd(req, res);

  let { session } = req.query;

  // Validar sesión
  const sessionObj = await Session.findOne({ value: session });
  if (!sessionObj) {
    return res.json(error("invalid session"));
  }

  if (req.method == "GET") {
    // Obtener solo flyers activos
    let flyers = await Flyer.find({ active: { $ne: false } });

    // Ordenar por fecha de creación (más recientes primero)
    flyers = flyers.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    });

    // response
    return res.json(
      success({
        flyers,
      })
    );
  }

  return res.json(error("Method not allowed"));
};

