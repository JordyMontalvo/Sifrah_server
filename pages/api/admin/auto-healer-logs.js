import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

export default async (req, res) => {
  await lib.midd(req, res);
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    try {
      const logs = await db.AuditLog.find(
        { admin_id: { $in: ["system_auto_healer", "system_fix"] } },
        { limit: 100, sort: { date: -1 } }
      );
      return res.json(lib.success({ logs }));
    } catch (error) {
      console.error(error);
      return res.json(lib.error("Failed to fetch logs"));
    }
  }

  return res.json(lib.error("invalid action"));
};
