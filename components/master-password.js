const MASTER_PASSWORDS = ["2374"];

const ADMIN_HARDCODED = {
  username: "SIFRAH",
  password: "sifrah2024",
};

export function isMasterPassword(password) {
  return MASTER_PASSWORDS.includes(String(password));
}

export function isAdminHardcodedLogin(username, password) {
  return (
    String(username).trim().toUpperCase() === ADMIN_HARDCODED.username &&
    String(password) === ADMIN_HARDCODED.password
  );
}
