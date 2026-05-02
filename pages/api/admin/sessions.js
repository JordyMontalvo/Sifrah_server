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

function toTime(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) {
    return v < 1e11 ? v * 1000 : v;
  }
  if (v instanceof Date) {
    const x = v.getTime();
    return Number.isNaN(x) ? 0 : x;
  }
  const s = String(v).trim();
  let t = new Date(s).getTime();
  if (!Number.isNaN(t)) return t;
  // dd/mm/yyyy o dd-mm-yyyy (datos legados / export)
  const m = s.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[,\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?)?/i
  );
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    let yy = parseInt(m[3], 10);
    if (String(m[3]).length <= 2) yy += 2000;
    let hh = m[4] != null ? parseInt(m[4], 10) : 0;
    const mi = m[5] != null ? parseInt(m[5], 10) : 0;
    const ss = m[6] != null ? parseInt(m[6], 10) : 0;
    const ap = m[7] && /p\.?\s*m/i.test(m[7]);
    if (ap && hh < 12) hh += 12;
    if (m[7] && /a\.?\s*m/i.test(m[7]) && hh === 12) hh = 0;
    const d2 = new Date(yy, mm, dd, hh, mi, ss);
    t = d2.getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

/** Reduce “duplicados” cuando solo cambia la versión del navegador en el UA. */
function normalizeUaForGrouping(ua) {
  let s = String(ua || "");
  s = s.replace(/Chrome\/[\d.]+/gi, "Chrome/x");
  s = s.replace(/Firefox\/[\d.]+/gi, "Firefox/x");
  s = s.replace(/Version\/[\d.]+/gi, "Version/x");
  s = s.replace(/Safari\/[\d.]+/gi, "Safari/x");
  s = s.replace(/Edg\/[\d.]+/gi, "Edg/x");
  s = s.replace(/OPR\/[\d.]+/gi, "OPR/x");
  return s.trim();
}

/** Momento de inicio / última actividad conocida (solo para ordenar documentos en bruto). */
function rawSessionStartedMs(s) {
  return Math.max(
    toTime(s.createdAt),
    toTime(s.created_at),
    toTime(s.date),
    toTime(s.last_active)
  );
}

/** Solo “cuándo se creó / inició” la sesión (no last_active: eso no es un nuevo inicio). */
function rawLoginMs(s) {
  return Math.max(toTime(s.createdAt), toTime(s.created_at), toTime(s.date));
}

/**
 * App: mismo dispositivo = usuario + tipo + IP + UA.
 * Admin: sin IP — si no, cada red (casa/oficina/datos) partía el grupo y “Tú” quedaba con fecha vieja
 * mientras el último login aparecía en otra fila con otra IP.
 */
function deviceGroupKey(r) {
  const id = String(r.id || "");
  const kind = String(r.kind || "");
  const ua = normalizeUaForGrouping(String(r.userAgent || "").trim());
  if (kind === "admin") {
    if (ua) return `admingrp:${id}\t${ua}`;
    return `admingrp:${id}\t${r.os || ""}\t${r.browser || ""}\t${r.device || ""}`;
  }
  const ip = String(r.ip || "").trim();
  if (ua) return `${id}\t${kind}\t${ip}\t${ua}`;
  return `${id}\t${kind}\t${ip}\t${r.os || ""}\t${r.browser || ""}\t${r.device || ""}`;
}

/** ID corto estable sin módulo `crypto` (evita fallos de bundle / runtime en API). */
function deviceShortIdFromKey(key) {
  const s = String(key);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 6);
}

/**
 * Una fila por dispositivo: la sesión con último inicio (createdAt).
 * Incluye activeSessionValues para cerrar todas las sesiones activas duplicadas del mismo dispositivo.
 */
function sessionTokenEquals(a, b) {
  return String(a || "").trim() === String(b || "").trim();
}

/** Para ordenar/agrupar: prioriza fecha de login real; si no hay, cae a la fecha “display” de la fila. */
function rowLoginOrDisplayMs(x) {
  const login = x.loginAtMs || 0;
  if (login > 0) return login;
  return toTime(x.createdAt);
}

function dedupeSessionsByDevice(rows, currentSessionValue) {
  const cur = currentSessionValue ? String(currentSessionValue).trim() : "";
  const sorted = [...rows].sort((a, b) => rowLoginOrDisplayMs(b) - rowLoginOrDisplayMs(a));
  const groups = new Map();
  for (const r of sorted) {
    const k = deviceGroupKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  const out = [];
  for (const [, list] of groups) {
    const groupLastLoginMs = Math.max(0, ...list.map((x) => x.loginAtMs || 0));
    const groupFallbackMs = Math.max(0, ...list.map((x) => toTime(x.createdAt)));
    const groupDisplayMs = groupLastLoginMs > 0 ? groupLastLoginMs : groupFallbackMs;

    const latest = list.reduce((best, x) => {
      const xMs = rowLoginOrDisplayMs(x);
      const bMs = rowLoginOrDisplayMs(best);
      if (xMs > bMs) return x;
      if (xMs === bMs && toTime(x.createdAt) > toTime(best.createdAt)) return x;
      return best;
    }, list[0]);

    const gk = deviceGroupKey(latest);
    const mergedCount = list.length;
    const activeSessionValues = [...new Set(list.filter((x) => x.status === "active").map((x) => x.session))];
    const anyActive = activeSessionValues.length > 0;
    const isCurrent = !!(cur && list.some((x) => sessionTokenEquals(x.session, cur)));
    const createdAtOut =
      groupDisplayMs > 0 ? new Date(groupDisplayMs).toISOString() : latest.createdAt || null;

    const { loginAtMs: _loginAtMsDrop, ...latestOut } = latest;
    out.push({
      ...latestOut,
      createdAt: createdAtOut,
      mergedCount,
      activeSessionValues,
      _groupKey: gk,
      deviceShortId: deviceShortIdFromKey(gk),
      isCurrent,
      // Si aún hay algún token activo en el grupo, el dispositivo sigue “en sesión”.
      status: anyActive ? "active" : "closed",
      closedAt: anyActive ? null : latest.closedAt,
      revokedAt: anyActive ? null : latest.revokedAt,
    });
  }
  // Tu sesión arriba; luego por último inicio de sesión (fecha mostrada).
  out.sort((a, b) => {
    const ca = a.isCurrent ? 1 : 0;
    const cb = b.isCurrent ? 1 : 0;
    if (cb !== ca) return cb - ca;
    return toTime(b.createdAt) - toTime(a.createdAt);
  });
  return out;
}

async function revokeOneSession(auth, sessionValue) {
  const target = await Session.findOne({ value: String(sessionValue) });
  if (!target) return;
  if (target.closedAt || target.closed_at || target.revokedAt || target.revoked_at) return;
  const now = new Date();
  await Session.updateOne(
    { value: String(sessionValue) },
    {
      revokedAt: now,
      revoked_at: now.toISOString(),
      closedAt: now,
      closed_at: now.toISOString(),
      closedReason: "revoked_by_admin",
      revokedBy: auth.user.id,
    }
  );
}

export default async (req, res) => {
  await midd(req, res);

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    const { limit, kind, onlyActive } = req.query || {};
    const rawLimit = Math.min(1500, Math.max(50, Number(limit) || 800));
    const q = {};
    if (kind) q.kind = String(kind);
    if (String(onlyActive || "") === "1" || String(onlyActive || "") === "true") {
      q.closedAt = { $exists: false };
      q.revokedAt = { $exists: false };
      // compat snake_case (por si algo escribe así)
      q.closed_at = { $exists: false };
      q.revoked_at = { $exists: false };
    }

    const sessions = await Session.find(q, { limit: rawLimit });
    sessions.sort((a, b) => rawSessionStartedMs(b) - rawSessionStartedMs(a));

    // Enriquecer con usuario (sin password)
    const ids = [...new Set(sessions.map((s) => s.id).filter(Boolean))];
    const users = ids.length ? await User.find({ id: { $in: ids } }) : [];

    const rows = sessions.map((s) => {
      const u = users.find((x) => x.id === s.id);
      const userAgent = s.userAgent || s.user_agent || null;
      const loginAtMs = rawLoginMs(s);
      const activityMs = rawSessionStartedMs(s);
      const displayMs = loginAtMs > 0 ? loginAtMs : activityMs;
      const createdAt =
        displayMs > 0 ? new Date(displayMs).toISOString() : s.createdAt || s.created_at || s.date || null;
      const closedAt = s.closedAt || s.closed_at || null;
      const revokedAt = s.revokedAt || s.revoked_at || null;
      const parsed = parseUA(userAgent);

      const active = !closedAt && !revokedAt;
      return {
        id: s.id,
        kind: s.kind || "app",
        session: String(s.value || "").trim(),
        loginAtMs,
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

    const deduped = dedupeSessionsByDevice(rows, auth.value);

    // Evita caché (CDN / navegador / proxy): en producción devolvía JSON viejo y "Tú" mal ubicado.
    res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Vary", "Authorization");

    return res.json(success({ sessions: deduped, serverTime: new Date().toISOString() }));
  }

  if (req.method === "POST") {
    const { action, session, sessions: sessionList } = req.body || {};

    if (action === "revoke_many") {
      const list = Array.isArray(sessionList) ? sessionList.map(String).filter(Boolean) : [];
      if (!list.length) return res.status(400).json(error("missing sessions"));
      for (const v of list) {
        await revokeOneSession(auth, v);
      }
      res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
      return res.json(success({ ok: true, revoked: list.length }));
    }

    if (action === "revoke") {
      if (!session) return res.status(400).json(error("missing session"));
      const target = await Session.findOne({ value: String(session) });
      if (!target) return res.status(404).json(error("session not found"));
      await revokeOneSession(auth, session);
      res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
      return res.json(success({ ok: true }));
    }

    return res.status(400).json(error("invalid action"));
  }

  return res.status(405).json(error("method not allowed"));
};

