import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

const { AuditLog, User } = db;
const { error, success, midd } = lib;

export default async (req, res) => {
  await midd(req, res);
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    const { collection, target_id, page = 1, limit = 30 } = req.query;

    const pageNum  = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip     = (pageNum - 1) * limitNum;

    // Build query
    const query = {};
    if (collection) query.collection = collection;
    if (target_id)  query.target_id  = target_id;

    // Fetch all matching logs sorted newest-first
    const allLogs = await AuditLog.find(query, { date: -1 });
    const total   = allLogs.length;
    const logs    = allLogs.slice(skip, skip + limitNum);

    // Enrich with admin name
    const adminIds = [...new Set(logs.map(l => l.admin_id).filter(Boolean))];
    const admins   = adminIds.length
      ? await User.find({ id: { $in: adminIds } })
      : [];
    const adminMap = new Map(admins.map(u => [String(u.id), `${u.name} ${u.lastName}`]));

    // Enrich with target user name (when collection === 'users')
    const userIds = [...new Set(logs.map(l => l.user_id).filter(Boolean))];
    const users   = userIds.length
      ? await User.find({ id: { $in: userIds } })
      : [];
    const userMap = new Map(users.map(u => [String(u.id), `${u.name} ${u.lastName}`]));

    const enriched = logs.map(log => ({
      id:           log.id,
      date:         log.date,
      collection:   log.collection,
      action:       log.action,
      target_id:    log.target_id,
      user_id:      log.user_id,
      user_name:    userMap.get(String(log.user_id)) || null,
      admin_id:     log.admin_id,
      admin_name:   adminMap.get(String(log.admin_id)) || null,
      state_before: log.state_before || null,
      state_after:  log.state_after  || null,
      metadata:     log.metadata     || null,
    }));

    return res.json(success({
      logs: enriched,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
    }));
  }

  return res.status(405).json(error("method not allowed"));
};
