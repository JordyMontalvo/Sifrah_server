import lib from "../../../components/lib";
import { uploadToBunny } from "../../../lib/bunnyUpload";

const { midd } = lib;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "100mb",
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
  const safeDir =
    String(dir)
      .replace(/[^a-zA-Z0-9._/-]/g, "")
      .replace(/\.\.+/g, "")
      .replace(/^\/+|\/+$/g, "") || "general";

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
