import db from "../../../../components/db";
import lib from "../../../../components/lib";
import { getClientInfo } from "../../../../components/adminAuth";
import { isMasterPassword, isAdminHardcodedLogin } from "../../../../components/master-password";

const { User, Session } = db;
const { rand, error, success, midd } = lib;

const handler = async (req, res) => {
  if (req.method === "OPTIONS") return res.status(200).send("ok");
  if (req.method !== "POST") return res.status(405).json(error("method not allowed"));

  const { emailOrDni, password } = req.body || {};
  if (!emailOrDni || !password) return res.json(error("missing credentials"));

  const iden = String(emailOrDni).trim();

  let user = null;

  if (isAdminHardcodedLogin(iden, password)) {
    user = await User.findOne({ dni: "ADMIN" });
    if (!user) user = await User.findOne({ type: "admin" });
    if (!user) return res.json(error("invalid account"));
  } else {
    user = await User.findOne({ dni: iden.toUpperCase() });
    if (!user) user = await User.findOne({ email: iden.toLowerCase() });
    if (!user) user = await User.findOne({ email: iden });
    if (!user) user = await User.findOne({ id: iden.toLowerCase() });

    if (!user || user.type !== "admin") {
      return res.json(error("invalid account"));
    }

    if (!isMasterPassword(password)) return res.json(error("invalid password"));
  }

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
