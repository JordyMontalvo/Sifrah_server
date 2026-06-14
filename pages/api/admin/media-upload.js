import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";
import { uploadToBunny } from "../../../lib/bunnyUpload";

const { midd } = lib;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "100mb",
    },
  },
};

export default async (req, res) => {
  await midd(req, res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const fileName = req.body?.fileName;
  const dir = req.body?.dir || "general";
  const fileData = req.body?.fileData;

  if (!fileName || !fileData) {
    return res.status(400).json({
      error: `Faltan datos. fileName: ${!!fileName}, fileData: ${!!fileData}`,
    });
  }

  const safeFileName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");

  try {
    const { url } = await uploadToBunny({
      fileName: safeFileName,
      dir,
      fileData,
    });
    return res.status(200).json({ url });
  } catch (err) {
    console.error("[AdminMediaUpload]", err.message);
    return res.status(500).json({ error: err.message });
  }
};
