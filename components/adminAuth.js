import db from "./db";
import lib from "./lib";

const { Session, User } = db;
const { error } = lib;

function getSessionValue(req) {
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (auth && typeof auth === "string") {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m && m[1]) return m[1].trim();
  }

  const headerSession = req.headers && (req.headers["x-session"] || req.headers["X-Session"]);
  if (headerSession && typeof headerSession === "string") return headerSession.trim();

  const q = req.query && (req.query.session || req.query._session);
  if (q && typeof q === "string") return q.trim();

  const b = req.body && (req.body.session || req.body._session);
  if (b && typeof b === "string") return b.trim();

  return null;
}

export async function requireAdmin(req, res) {
  const value = getSessionValue(req);
  if (!value) {
    res.statusCode = 401;
    res.json(error("missing session"));
    return null;
  }

  const session = await Session.findOne({ value });
  if (!session) {
    res.statusCode = 401;
    res.json(error("invalid session"));
    return null;
  }

  const user = await User.findOne({ id: session.id });
  if (!user || user.type !== "admin") {
    res.statusCode = 403;
    res.json(error("forbidden"));
    return null;
  }

  return { user, session, value };
}

export function getClientInfo(req) {
  const userAgent = (req.headers && (req.headers["user-agent"] || req.headers["User-Agent"])) || null;
  const ip =
    (req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"])) ||
    (req.connection && req.connection.remoteAddress) ||
    null;

  return { userAgent, ip: typeof ip === "string" ? ip.split(",")[0].trim() : ip };
}

