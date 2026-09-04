import bcrypt from "bcrypt";
import db from "../../../../components/db";
import lib from "../../../../components/lib";
import { getClientInfo } from "../../../../components/adminAuth";
import { isAdminHardcodedLogin } from "../../../../components/master-password";
import { getRetryAfter, registerFailure, clearFailures, throttleMessage } from "../../../../components/login-throttle";

const { User, Session } = db;
const { rand, error, success, midd } = lib;

const handler = async (req, res) => {
  if (req.method === "OPTIONS") return res.status(200).send("ok");
  if (req.method !== "POST") return res.status(405).json(error("method not allowed"));

  const { emailOrDni, password } = req.body || {};
  if (!emailOrDni || !password) return res.json(error("missing credentials"));

  const iden = String(emailOrDni).trim();

  // Freno de fuerza bruta por cuenta. Se separa del espacio de nombres de la
  // aplicación para que un administrador y un socio con el mismo identificador
  // no compartan contador.
  const throttleKey = "admin:" + iden.toLowerCase();
  const retryAfter = getRetryAfter(throttleKey);
  if (retryAfter > 0) {
    return res.json({ error: true, code: "TOO_MANY_ATTEMPTS", msg: throttleMessage(retryAfter) });
  }

  let user = null;
  let authMethod = "password";

  if (isAdminHardcodedLogin(iden, password)) {
    // Acceso de emergencia por variables de entorno. Se marca en la sesion
    // para poder distinguirlo despues de un inicio de sesion normal.
    user = await User.findOne({ dni: "ADMIN" });
    if (!user) user = await User.findOne({ type: "admin" });
    if (!user) return res.json(error("invalid account"));
    authMethod = "break-glass";
  } else {
    user = await User.findOne({ dni: iden.toUpperCase() });
    if (!user) user = await User.findOne({ email: iden.toLowerCase() });
    if (!user) user = await User.findOne({ email: iden });
    if (!user) user = await User.findOne({ id: iden.toLowerCase() });

    if (!user || user.type !== "admin") {
      registerFailure(throttleKey);
      return res.json(error("invalid account"));
    }

    // Cada administrador responde por su propio hash. Con la clave maestra
    // compartida todos entraban con la misma credencial y no habia forma de
    // saber que operador realizo cada accion.
    let valid = false;
    if (user.password) {
      try {
        valid = await bcrypt.compare(String(password), user.password);
      } catch {
        valid = false;
      }
    }

    if (!valid) {
      registerFailure(throttleKey);
      return res.json(error("invalid password"));
    }
  }

  clearFailures(throttleKey);

  const sessionValue = rand() + rand() + rand();
  const { userAgent, ip } = getClientInfo(req);

  await Session.insert({
    id: user.id,
    value: sessionValue,
    kind: "admin",
    authMethod,
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
