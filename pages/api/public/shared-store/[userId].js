import db from "../../../../components/db";
import lib from "../../../../components/lib";
import {
  mainCatalogMongoFilter,
  filterSifrahCatalogProducts,
  filterSharedStoreCatalogProducts,
} from "../../../../lib/productCatalog";
import { sortProducts } from "../../../../lib/productSort";
const { applyCORS } = require("../../../../middleware/middleware-cors");

const { User, Product, Banner } = db;
const { error, success, midd } = lib;

/**
 * Endpoint público para obtener la tienda compartida de un usuario
 * Reutiliza la misma lógica que /api/app/activation
 * 
 * GET /api/public/shared-store/[userId]
 * - userId: identificador publico del socio dueño de la tienda
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
    // Se busca por el identificador publico del socio. Antes se buscaba por el
    // token de sesion, de modo que el enlace que el socio publicaba en redes
    // sociales entregaba su sesion a cualquiera que lo viera.
    const user = await User.findOne({ id: String(userId) });

    if (!user) {
      return res.json(error("Usuario no encontrado"));
    }

    // La tienda del socio muestra solo los productos de la línea SIFRAH
    const filterFn =
      typeof filterSharedStoreCatalogProducts === "function"
        ? filterSharedStoreCatalogProducts
        : (prods) =>
            filterSifrahCatalogProducts(prods).filter(
              (p) => p.visible_shared_store !== false
            );
    let _products = filterFn(await Product.find(mainCatalogMongoFilter()));

    _products = sortProducts(_products);

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

    const ownerFirstName = (user.name || "").trim();
    const ownerLastName = (user.lastName || "").trim();
    const ownerFullName = `${ownerFirstName} ${ownerLastName}`.trim() || "Distribuidor Sifrah";

    // Responder con los datos en el mismo formato que activation
    return res.json(
      success({
        products: _products,
        ownerName: ownerFullName,
        ownerFirstName,
        ownerLastName,
        ownerFullName,
        ownerPhoto: user.photo || null,
        activationBanners,
      })
    );
  } catch (err) {
    console.error("Error en /api/public/shared-store:", err);
    return res.json(error("Error al cargar la tienda"));
  }
};
