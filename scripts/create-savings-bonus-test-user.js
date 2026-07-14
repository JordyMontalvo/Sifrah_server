require("dotenv").config();

const bcrypt = require("bcrypt");
const db = require("../components/db");

const { User, Tree, Transaction } = db;

function rand() {
  return Math.random().toString(36).substr(2);
}

function generateToken() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 6; i++) {
    token += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return token;
}

function calcSavingsBonusBalance(transactions) {
  if (!Array.isArray(transactions)) return 0;
  const ins = transactions
    .filter((t) => t.type === "in" && t.wallet_tipo === "BONO_AHORRO")
    .reduce((sum, t) => sum + Number(t.value || 0), 0);
  const outs = transactions
    .filter((t) => t.type === "out" && t.wallet_tipo === "BONO_AHORRO")
    .reduce((sum, t) => sum + Number(t.value || 0), 0);
  return ins - outs;
}

const TEST_USER = {
  dni: process.env.BONO_TEST_DNI || "77777701",
  password: process.env.BONO_TEST_PASSWORD || "BonoTest2024!",
  name: "Usuario",
  lastName: "Bono Ahorro",
  email: "bono.test@gmail.com",
  phone: "999888777",
  coins: Number(process.env.BONO_TEST_COINS || 100),
};

async function ensureUniqueToken() {
  for (let i = 0; i < 10; i++) {
    const token = generateToken();
    const existing = await User.findOne({ token });
    if (!existing) return token;
  }
  throw new Error("No se pudo generar un token único");
}

async function main() {
  const sponsor =
    (await User.findOne({ dni: "40707741" })) ||
    (await User.findOne({ affiliated: true, activated: true }));

  if (!sponsor) {
    throw new Error("No hay patrocinador activo en la base de datos");
  }

  const password = await bcrypt.hash(TEST_USER.password, 12);
  const existing = await User.findOne({ dni: TEST_USER.dni });
  const now = new Date();

  let userId;
  let token;

  if (existing) {
    userId = existing.id;
    token = existing.token || (await ensureUniqueToken());

    await User.update(
      { id: userId },
      {
        name: TEST_USER.name,
        lastName: TEST_USER.lastName,
        email: TEST_USER.email,
        phone: TEST_USER.phone,
        password,
        parentId: sponsor.id,
        affiliated: true,
        _activated: true,
        activated: true,
        status: "active",
        plan: existing.plan || "default",
        photo: existing.photo || "/avatar.png",
        tree: true,
        token,
        points: existing.points || 0,
        updatedAt: now,
      }
    );
  } else {
    userId = rand() + rand() + rand();
    token = await ensureUniqueToken();

    await User.insert({
      id: userId,
      date: now,
      country: "PE",
      dni: TEST_USER.dni,
      name: TEST_USER.name,
      lastName: TEST_USER.lastName,
      birthdate: "1990-01-01",
      email: TEST_USER.email,
      password,
      phone: TEST_USER.phone,
      department: "Lima",
      province: "Lima",
      district: "San Juan de Lurigancho",
      parentId: sponsor.id,
      affiliated: true,
      _activated: true,
      activated: true,
      status: "active",
      plan: "default",
      photo: "/avatar.png",
      points: 0,
      tree: true,
      token,
    });

    const parentNodeId =
      sponsor.coverage && sponsor.coverage.id ? sponsor.coverage.id : sponsor.id;
    const parentNode = await Tree.findOne({ id: parentNodeId });
    if (parentNode && !parentNode.childs.includes(userId)) {
      parentNode.childs.push(userId);
      await Tree.update({ id: parentNodeId }, { childs: parentNode.childs });
    }
    await Tree.insert({ id: userId, childs: [], parent: parentNodeId });
  }

  const txId = `bono-test-${TEST_USER.dni}`;
  const existingTx = await Transaction.findOne({ id: txId });

  if (existingTx) {
    await Transaction.update(
      { id: txId },
      {
        user_id: userId,
        type: "in",
        value: TEST_USER.coins,
        name: "savings_bonus_test",
        desc: "Saldo de prueba local Bono Ahorro",
        virtual: false,
        wallet_tipo: "BONO_AHORRO",
        date: now,
      }
    );
  } else {
    await Transaction.insert({
      id: txId,
      date: now,
      user_id: userId,
      type: "in",
      value: TEST_USER.coins,
      name: "savings_bonus_test",
      desc: "Saldo de prueba local Bono Ahorro",
      virtual: false,
      wallet_tipo: "BONO_AHORRO",
    });
  }

  const txs = await Transaction.find({
    user_id: userId,
    virtual: { $in: [null, false] },
  });
  const balance = calcSavingsBonusBalance(txs);

  console.log("[OK] Usuario de prueba Bono Ahorro listo:");
  console.log({
    dni: TEST_USER.dni,
    password: TEST_USER.password,
    name: `${TEST_USER.name} ${TEST_USER.lastName}`,
    affiliated: true,
    activated: true,
    savingsBalance: balance,
    sponsorDni: sponsor.dni,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[ERROR]", err);
    process.exit(1);
  });
