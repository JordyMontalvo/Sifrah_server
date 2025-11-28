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
    try {
      // Obtener todos los flyers (incluyendo inactivos temporalmente para debug)
      let allFlyers = await Flyer.find({});
      
      console.log(`[Flyers API] Total flyers encontrados: ${allFlyers.length}`);
      
      // Filtrar solo flyers activos (si active no existe, considerarlo activo)
      let flyers = allFlyers.filter(f => {
        // Si no tiene campo active, considerarlo activo
        if (f.active === undefined || f.active === null) return true;
        // Si tiene active, debe ser true
        return f.active === true;
      });
      
      console.log(`[Flyers API] Flyers activos: ${flyers.length}`);
      
      if (flyers.length > 0) {
        console.log(`[Flyers API] Primer flyer:`, {
          id: flyers[0].id,
          name: flyers[0].name,
          base_image_url: flyers[0].base_image_url,
          active: flyers[0].active
        });
      }

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
    } catch (error) {
      console.error('[Flyers API] Error:', error);
      return res.json(error(error.message || 'Error al obtener flyers'));
    }
  }

  return res.json(error("Method not allowed"));
};

