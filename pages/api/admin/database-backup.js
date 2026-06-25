import { requireAdmin } from "../../../components/adminAuth";
import lib from "../../../components/lib";
import { createDatabaseBackupBuffer } from "../../../lib/mongoBackup";

const { midd } = lib;

export default async (req, res) => {
  await midd(req, res);

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { buffer, filename } = await createDatabaseBackupBuffer();

    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("[database-backup]", error);
    return res.status(500).json({
      error: "No se pudo generar el respaldo de la base de datos",
      details: error.message || String(error),
    });
  }
};

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};
