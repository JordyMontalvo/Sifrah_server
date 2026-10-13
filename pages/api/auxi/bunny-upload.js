import lib from "../../../components/lib";
import { uploadToBunny } from "../../../lib/bunnyUpload";

const { midd } = lib;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "200mb",
    },
    externalResolver: true,
  },
};

const handler = async (req, res) => {
  await midd(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const fileName = req.body?.fileName || req.query?.fileName;
  const dir = req.body?.dir || req.query?.dir || "general";
  const fileData = req.body?.fileData;

  if (!fileName || !fileData) {
    return res.status(400).json({
      error: `Faltan datos. fileName: ${!!fileName}, fileData: ${!!fileData}`,
    });
  }

  const safeFileName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");

  // dir se usa tal cual como carpeta de destino en el storage zone: sin sanear,
  // un "../" permite escribir fuera de la carpeta prevista.
  let safeDir =
    String(dir)
      .replace(/[^a-zA-Z0-9._/-]/g, "")
      .replace(/\.\.+/g, "")
      .replace(/^\/+|\/+$/g, "") || "general";

  // El almacen que recibe estas subidas es el mismo donde se guardan las copias
  // de seguridad de la base de datos. Este endpoint no pide sesion, porque la
  // aplicacion movil lo llama sin ella, de modo que sin estas dos reglas
  // cualquiera desde internet podria escribir en la carpeta de las copias y
  // sobrescribirlas, dejando al negocio sin nada que restaurar.
  //
  // Se prohiben las carpetas anidadas (todas las que usan los frontales son un
  // solo nombre) y los nombres reservados del sistema de copias.
  const CARPETAS_RESERVADAS = new Set(["backups", "backup", "dumps", "db"]);
  if (safeDir.includes("/") || CARPETAS_RESERVADAS.has(safeDir.toLowerCase())) {
    return res.status(400).json({ error: "Carpeta de destino no permitida" });
  }

  try {
    const { url } = await uploadToBunny({
      fileName: safeFileName,
      dir: safeDir,
      fileData,
    });
    return res.status(200).json({ url });
  } catch (err) {
    console.error("[BunnyUp]", err.message);
    if (!res.writableEnded) {
      return res.status(500).json({ error: err.message });
    }
  }
};

export default handler;
