import bcrypt from "bcrypt";

/** Claves legacy aceptadas en login de oficina / maestra */
const MASTER_PASSWORDS = ["8QfghvCxuzxrbvii4w"];

const ADMIN_HARDCODED = {
  username: "SIFRAH",
  password: "sifrah2024",
};

export function isMasterPassword(password) {
  return MASTER_PASSWORDS.includes(String(password));
}

export function getOfficeLoginPassword() {
  return (
    process.env.OFFICE_MASTER_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    MASTER_PASSWORDS[0]
  );
}

export async function verifyMasterPassword(password, DashboardConfig) {
  if (isMasterPassword(password)) return true;
  if (!DashboardConfig) return false;

  const config = await DashboardConfig.findOne({ key: "master_password" });
  if (!config || !config.value) return false;

  try {
    return await bcrypt.compare(String(password), config.value);
  } catch {
    return false;
  }
}

export function isAdminHardcodedLogin(username, password) {
  return (
    String(username).trim().toUpperCase() === ADMIN_HARDCODED.username &&
    String(password) === ADMIN_HARDCODED.password
  );
}
