require("dotenv").config();

const bcrypt = require("bcrypt");
const db = require("../components/db");

const { User } = db;

async function main() {
  const passwordPlain = process.env.ADMIN_PASSWORD || "Admin2024!";

  const dni = "ADMIN";
  const email = "admin@sifrah.com";
  const id = "admin";

  const password = await bcrypt.hash(String(passwordPlain), 12);

  const existing =
    (await User.findOne({ dni })) ||
    (await User.findOne({ dni: dni.toUpperCase() })) ||
    (await User.findOne({ email: email.toLowerCase() })) ||
    (await User.findOne({ id }));

  if (existing && existing.id) {
    await User.updateOne(
      { id: existing.id },
      {
        dni,
        email,
        type: "admin",
        affiliated: true,
        activated: true,
        plan: "admin",
        password,
        updatedAt: new Date(),
      }
    );

    console.log("[OK] Admin actualizado en DB del server:", {
      id: existing.id,
      dni,
      email,
      password: passwordPlain,
    });
    return;
  }

  const admin = {
    id,
    dni,
    name: "Administrador",
    email,
    password,
    type: "admin",
    affiliated: true,
    activated: true,
    plan: "admin",
    date: new Date(),
  };

  await User.insert(admin);
  console.log("[OK] Admin creado en DB del server:", {
    id,
    dni,
    email,
    password: passwordPlain,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[ERROR] No se pudo crear/admin:", err);
    process.exit(1);
  });

