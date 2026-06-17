import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin, getClientInfo } from "../../../components/adminAuth";

const { User, Session } = db;
const { rand, error, success, midd } = lib;

const ALLOWED_PATHS = new Set([
  "dashboard",
  "affiliation",
  "activation",
  "profile",
  "status",
]);

async function impersonate(req, res) {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.json(error("method not allowed"));
  }

  let { dni, path = "dashboard", office_id = "central" } = req.body || {};
  dni = String(dni || "").trim();
  path = String(path || "dashboard").trim().replace(/^\//, "");
  office_id = String(office_id || "central").trim();

  if (!dni) return res.json(error("missing dni"));
  if (!ALLOWED_PATHS.has(path)) return res.json(error("invalid path"));

  const user = await User.findOne({ dni });
  if (!user) return res.json(error("dni not found"));

  if (user.status === "eliminated") {
    return res.json({
      error: true,
      code: "ACCOUNT_ELIMINATED",
      msg: "La cuenta del socio fue dada de baja por inactividad.",
    });
  }

  if (user.status === "blocked") {
    return res.json({
      error: true,
      code: "ACCOUNT_BLOCKED",
      msg: "La cuenta del socio está bloqueada.",
    });
  }

  const { ip, userAgent } = getClientInfo(req);
  const session = rand() + rand() + rand();

  await Session.insert({
    id: user.id,
    value: session,
    office_id,
    ip: ip || null,
    user_agent: userAgent || null,
    os: "Admin Operations",
    browser: "Office Embed",
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
    impersonated_by: auth.user.id,
  });

  return res.json(
    success({
      session,
      path,
      office_id,
      dni: user.dni,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      photo: user.photo,
      plan: user.plan,
      affiliated: user.affiliated,
      activated: user.activated,
      _activated: user._activated,
      country: user.country,
      tree: user.tree,
      total_points: user.total_points,
    })
  );
}

export default async (req, res) => {
  await midd(req, res);
  return impersonate(req, res);
};
