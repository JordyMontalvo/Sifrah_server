import db from "../../../components/db";
import lib from "../../../components/lib";
import fetch from "node-fetch";

const { User, Session, Token, Tree } = db;
const { rand, error, success, midd } = lib;

const GOOGLE_CLIENT_ID =
  "511469100162-s6f2f9qbkr533hbvaoevbr6m0mhfdrvk.apps.googleusercontent.com";

async function verifyGoogleToken(id_token) {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.aud !== GOOGLE_CLIENT_ID) return null;
  return data;
}

const LoginGoogle = async (req, res) => {
  const { id_token } = req.body;
  if (!id_token) return res.json(error("No id_token"));

  const googleData = await verifyGoogleToken(id_token);
  if (!googleData) return res.json(error("Token de Google inválido"));

  // googleData: { sub, email, name, picture, ... }
  let user = await User.findOne({ email: googleData.email });

  if (!user) {
    // Crear usuario básico (sin afiliación ni código)
    const id = rand();
    const session = rand() + rand() + rand();
    // Buscar un token libre
    const token = await Token.findOne({ free: true });
    if (!token) return res.json(error("token not available"));
    await Token.update({ value: token.value }, { free: false });
    await User.insert({
      id,
      date: new Date(),
      country: "",
      dni: "",
      name: googleData.given_name || googleData.name,
      lastName: googleData.family_name || "",
      birthdate: "",
      email: googleData.email,
      password: "",
      phone: "",
      parentId: "",
      affiliated: false,
      _activated: false,
      activated: false,
      plan: "default",
      points: 0,
      tree: true,
      token: token.value,
    });
    // Crear sesión
    await Session.insert({ id, value: session });
    // Insertar en árbol
    await Tree.insert({ id, childs: [], parent: null });
    return res.json(success({ session }));
  } else {
    // Usuario ya existe, crear sesión
    const session = rand() + rand() + rand();
    await Session.insert({ id: user.id, value: session });
    return res.json(success({ session }));
  }
};

export default async (req, res) => {
  await midd(req, res);
  return LoginGoogle(req, res);
};
