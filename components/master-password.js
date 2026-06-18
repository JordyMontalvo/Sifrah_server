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
  console.log("verifyMasterPassword called with password:", password);
  if (isMasterPassword(password)) {
    console.log("Matched hardcoded master password");
    return true;
  }
  if (!DashboardConfig) {
    console.log("DashboardConfig is undefined");
    return false;
  }

  const config = await DashboardConfig.findOne({ key: "master_password" });
  console.log("verifyMasterPassword config found:", config);
  if (!config || !config.value) {
    console.log("No config or config.value found");
    return false;
  }

  try {
    const result = await bcrypt.compare(String(password), config.value);
    console.log("bcrypt.compare result:", result);
    return result;
  } catch (error) {
    console.log("bcrypt.compare threw error:", error);
    return false;
  }
}

export function isAdminHardcodedLogin(username, password) {
  return (
    String(username).trim().toUpperCase() === ADMIN_HARDCODED.username &&
    String(password) === ADMIN_HARDCODED.password
  );
}
