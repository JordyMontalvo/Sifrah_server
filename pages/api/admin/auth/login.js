import bcrypt from "bcrypt";
import db from "../../../../components/db";
import lib from "../../../../components/lib";
import { getClientInfo } from "../../../../components/adminAuth";

const { User, Session } = db;
const { rand, error, success, midd } = lib;

const handler = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json(error("method not allowed"));

  const { emailOrDni, password } = req.body || {};
  if (!emailOrDni || !password) return res.json(error("missing credentials"));

  const q = String(emailOrDni).includes("@")
    ? { email: String(emailOrDni).trim() }
    : { dni: String(emailOrDni).trim() };

  // Buscar primero por email, luego por DNI como fallback
  let user = await User.findOne(q);
  if (!user && !String(emailOrDni).includes('@')) {
    // intentar búsqueda case-insensitive por DNI
    user = await User.findOne({ dni: String(emailOrDni).trim().toUpperCase() });
  }
  if (!user && String(emailOrDni).includes('@')) {
    // fallback: buscar por DNI si el email falló
    user = await User.findOne({ dni: String(emailOrDni).trim() });
  }
  if (!user || user.type !== "admin") return res.json(error("invalid account"));


  const ok = await bcrypt.compare(String(password), String(user.password || ""));
  if (!ok) return res.json(error("invalid password"));

  const sessionValue = rand() + rand() + rand();
  const { userAgent, ip } = getClientInfo(req);

  await Session.insert({
    id: user.id,
    value: sessionValue,
    kind: "admin",
    createdAt: new Date(),
    userAgent,
    ip,
  });

  const account = {
    id: user.id,
    dni: user.dni,
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    type: user.type,
  };

  return res.json(success({ session: sessionValue, account }));
};

export default async (req, res) => {
  await midd(req, res);
  return handler(req, res);
};

