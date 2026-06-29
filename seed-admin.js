const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  try {
    let admin = await prisma.user.findUnique({ where: { dni: "ADMIN" } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: "Administrador",
          dni: "ADMIN",
          type: "admin",
          status: "active"
        }
      });
      console.log("✅ Usuario ADMIN creado exitosamente en PostgreSQL:", admin);
    } else {
      console.log("ℹ️ El usuario ADMIN ya existía. Actualizando su type a 'admin' por si acaso...");
      admin = await prisma.user.update({
        where: { dni: "ADMIN" },
        data: { type: "admin" }
      });
      console.log("✅ Usuario ADMIN actualizado:", admin);
    }
  } catch (error) {
    console.error("❌ Error creando el admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
