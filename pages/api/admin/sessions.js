import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

const { Session, User } = db;
const { success, midd } = lib;

export default async (req, res) => {
  await midd(req, res);

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const { limit = 200, kind } = req.query || {};
  const q = {};
  if (kind) q.kind = String(kind);

  const sessions = await Session.find(q, { sort: { createdAt: -1 }, limit: Number(limit) || 200 });

  // Enriquecer con usuario (sin password)
  const ids = [...new Set(sessions.map((s) => s.id).filter(Boolean))];
  const users = ids.length ? await User.find({ id: { $in: ids } }) : [];

  const rows = sessions.map((s) => {
    const u = users.find((x) => x.id === s.id);
    return {
      id: s.id,
      kind: s.kind || "app",
      session: s.value,
      createdAt: s.createdAt || s.date || null,
      office_id: s.office_id || null,
      userAgent: s.userAgent || null,
      ip: s.ip || null,
      user: u
        ? { id: u.id, dni: u.dni, name: u.name, lastName: u.lastName, email: u.email, type: u.type }
        : null,
    };
  });

  return res.json(success({ sessions: rows }));
};

