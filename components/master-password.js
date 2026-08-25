import bcrypt from "bcrypt";

/**
 * Claves maestras / de oficina y credenciales de admin de emergencia.
 *
 * IMPORTANTE: estos valores NO deben ir hardcodeados. Se leen exclusivamente
 * desde variables de entorno para no exponerlos en el código ni en git.
 *
 *   MASTER_PASSWORDS      Lista separada por comas de claves maestras aceptadas.
 *                         (Compatibilidad: si no está, se usan OFFICE_MASTER_PASSWORD
 *                          o ADMIN_PASSWORD como clave única.)
 *   ADMIN_LOGIN_USER      Usuario de acceso de emergencia al panel admin.
 *   ADMIN_LOGIN_PASSWORD  Contraseña de ese acceso de emergencia.
 */

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const MASTER_PASSWORDS = parseList(
  process.env.MASTER_PASSWORDS ||
    process.env.OFFICE_MASTER_PASSWORD ||
    process.env.ADMIN_PASSWORD
);

const ADMIN_HARDCODED = {
  username: String(process.env.ADMIN_LOGIN_USER || "").trim().toUpperCase(),
  password: String(process.env.ADMIN_LOGIN_PASSWORD || ""),
};

export function isMasterPassword(password) {
  if (!MASTER_PASSWORDS.length) return false;
  return MASTER_PASSWORDS.includes(String(password));
}

export function getOfficeLoginPassword() {
  return (
    process.env.OFFICE_MASTER_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    MASTER_PASSWORDS[0] ||
    ""
  );
}

export async function verifyMasterPassword(password, DashboardConfig) {
  if (isMasterPassword(password)) {
    return true;
  }
  if (!DashboardConfig) {
    return false;
  }

  const config = await DashboardConfig.findOne({ key: "master_password" });
  if (!config || !config.value) {
    return false;
  }

  try {
    return await bcrypt.compare(String(password), config.value);
  } catch (error) {
    return false;
  }
}

export function isAdminHardcodedLogin(username, password) {
  if (!ADMIN_HARDCODED.username || !ADMIN_HARDCODED.password) return false;
  return (
    String(username).trim().toUpperCase() === ADMIN_HARDCODED.username &&
    String(password) === ADMIN_HARDCODED.password
  );
}
