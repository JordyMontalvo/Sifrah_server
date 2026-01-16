import db from "../../../../components/db";
import lib from "../../../../components/lib";
const { applyCORS } = require("../../../../middleware/middleware-cors");

const { User, Product, Session, Banner } = db;
const { error, success, midd } = lib;

/**
 * Endpoint público para obtener la tienda compartida de un usuario
 * Reutiliza la misma lógica que /api/app/activation
 * 
 * GET /api/public/shared-store/[userId]
 * - userId: session ID del usuario dueño de la tienda
 * - No requiere autenticación
 * - Retorna: productos, banners, nombre del dueño
 */
export default async (req, res) => {
  // Aplicar CORS primero
  applyCORS(req, res);

  // Manejar preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  await midd(req, res);

  const { userId } = req.query;

  if (!userId) {
    return res.json(error("ID de usuario no proporcionado"));
  }

  try {
    // Buscar el usuario por su session ID
    const session = await Session.findOne({ value: userId });
    
    if (!session) {
      return res.json(error("Usuario no encontrado"));
    }

    const user = await User.findOne({ id: session.id });
    
    if (!user) {
      return res.json(error("Usuario no encontrado"));
    }

    // ⭐ REUTILIZAR LA MISMA LÓGICA DE /api/app/activation
    // Obtener productos - MISMA CONSULTA que activation
    let _products = await Product.find({});

    // Aplicar el mismo filtro que en activation
    if (!user.activated) {
      _products = _products.filter((p) => p.type != "Promoción");
    }

    // ⭐ Obtener banners de activación - MISMA LÓGICA que /api/app/activation-banners
    let activationBanners = await Banner.findOne({ id: "activation_banners" });
    
    // Si no existe, retornar objeto vacío
    if (!activationBanners) {
      activationBanners = {
        left: "",
        centerTop: "",
        centerBottom: "",
        right: "",
        leftUrl: "",
        centerTopUrl: "",
        centerBottomUrl: "",
        rightUrl: ""
      };
    }

    // Responder con los datos en el mismo formato que activation
    return res.json(
      success({
        products: _products,
        ownerName: `${user.name} ${user.lastName}`,
        activationBanners,
      })
    );
  } catch (err) {
    console.error("Error en /api/public/shared-store:", err);
    return res.json(error("Error al cargar la tienda"));
  }
};
