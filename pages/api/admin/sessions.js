import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

const { Session, User } = db;
const { success, error, midd } = lib;

function parseUA(userAgent) {
  const ua = String(userAgent || "");
  const lower = ua.toLowerCase();

  // Browser (orden importa)
  let browser = "Desconocido";
  if (lower.includes("edg/") || lower.includes("edge/")) browser = "Edge";
  else if (lower.includes("opr/") || lower.includes("opera")) browser = "Opera";
  else if (lower.includes("chrome/") && !lower.includes("edg/") && !lower.includes("opr/")) browser = "Chrome";
  else if (lower.includes("firefox/")) browser = "Firefox";
  else if (lower.includes("safari/") && !lower.includes("chrome/")) browser = "Safari";

  // OS
  let os = "Desconocido";
  if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")) os = "iOS";
  else if (lower.includes("windows nt")) os = "Windows";
  else if (lower.includes("mac os x") && !lower.includes("iphone") && !lower.includes("ipad")) os = "MacOS";
  else if (lower.includes("linux")) os = "Linux";

  // Modelo/dispositivo (best-effort: extrae lo que va dentro de paréntesis)
  let device = null;
  const m = ua.match(/\(([^)]+)\)/);
  if (m && m[1]) {
    const parts = m[1]
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean);
    // Selección heurística: preferir algo que no sea "KHTML", "like Gecko", etc.
    const skip = ["khtml", "like gecko", "gecko", "mozilla", "applewebkit"];
    const candidate = parts.find((p) => !skip.some((s) => p.toLowerCase().includes(s)));
    device = candidate || parts[0] || null;
  }

  return { os, browser, device };
}

export default async (req, res) => {
  await midd(req, res);

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    const { limit = 200, kind, onlyActive } = req.query || {};
    const q = {};
    if (kind) q.kind = String(kind);
    if (String(onlyActive || "") === "1" || String(onlyActive || "") === "true") {
      q.closedAt = { $exists: false };
      q.revokedAt = { $exists: false };
      // compat snake_case (por si algo escribe así)
      q.closed_at = { $exists: false };
      q.revoked_at = { $exists: false };
    }

    const sessions = await Session.find(q, { sort: { createdAt: -1 }, limit: Number(limit) || 200 });

    // Enriquecer con usuario (sin password)
    const ids = [...new Set(sessions.map((s) => s.id).filter(Boolean))];
    const users = ids.length ? await User.find({ id: { $in: ids } }) : [];

    const rows = sessions.map((s) => {
      const u = users.find((x) => x.id === s.id);
      const userAgent = s.userAgent || s.user_agent || null;
      const createdAt = s.createdAt || s.created_at || s.date || null;
      const closedAt = s.closedAt || s.closed_at || null;
      const revokedAt = s.revokedAt || s.revoked_at || null;
      const parsed = parseUA(userAgent);

      const active = !closedAt && !revokedAt;
      return {
        id: s.id,
        kind: s.kind || "app",
        session: s.value,
        createdAt,
        closedAt,
        revokedAt,
        status: active ? "active" : "closed",
        office_id: s.office_id || null,
        userAgent,
        ip: s.ip || null,
        os: s.os || parsed.os,
        browser: s.browser || parsed.browser,
        device: s.device || parsed.device,
        user: u
          ? { id: u.id, dni: u.dni, name: u.name, lastName: u.lastName, email: u.email, type: u.type }
          : null,
      };
    });

    return res.json(success({ sessions: rows }));
  }

  if (req.method === "POST") {
    const { action, session } = req.body || {};
    if (action !== "revoke") return res.status(400).json(error("invalid action"));
    if (!session) return res.status(400).json(error("missing session"));

    const target = await Session.findOne({ value: String(session) });
    if (!target) return res.status(404).json(error("session not found"));

    // No permitir revocar una sesión ya cerrada
    if (target.closedAt || target.closed_at || target.revokedAt || target.revoked_at) {
      return res.json(success({ ok: true }));
    }

    const now = new Date();
    await Session.updateOne(
      { value: String(session) },
      {
        revokedAt: now,
        revoked_at: now.toISOString(),
        closedAt: now,
        closed_at: now.toISOString(),
        closedReason: "revoked_by_admin",
        revokedBy: auth.user.id,
      }
    );

    return res.json(success({ ok: true }));
  }

  return res.status(405).json(error("method not allowed"));
};

