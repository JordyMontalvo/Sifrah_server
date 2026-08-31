import db from "../../../components/db"
import lib from "../../../components/lib"
import { applyCORS } from "../../../middleware/middleware-cors"

const { User, Token } = db
const { error, success, midd, rand } = lib

const TOKEN_TTL_MS = 60 * 60 * 1000
const APP_URL = process.env.APP_URL || "https://sifrah.vercel.app"

function readEmail(req) {
  const body = req.body
  if (body == null) return ""
  if (typeof body === "string") {
    const trimmed = body.trim()
    if (!trimmed) return ""
    try {
      return readEmail({ body: JSON.parse(trimmed) })
    } catch (e) {
      return trimmed
    }
  }
  if (typeof body === "object") {
    const value = body.email || body.Email || body.mail
    if (typeof value === "string") return value
  }
  return ""
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function findUserByEmail(email) {
  const normalized = email.trim().toLowerCase()
  const exact = await User.findOne({ email: normalized })
  if (exact) return exact
  const original = await User.findOne({ email })
  if (original) return original
  return User.findOne({
    email: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" },
  })
}

export default async (req, res) => {
  applyCORS(req, res)
  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  await midd(req, res)

  if (req.method !== "POST") return res.status(405).json(error("method not allowed"))

  const email = readEmail(req)
  if (!email) {
    return res.json(error("El email es requerido"))
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = await findUserByEmail(normalizedEmail)

  // Siempre respondemos OK aunque no exista el email (evitar enumeración de usuarios)
  if (!user) {
    return res.json(success({ msg: "Si el email está registrado, recibirás las instrucciones." }))
  }

  try {
    await Token.updateMany(
      { user_id: user.id, type: "password_reset", used: false },
      { used: true }
    )
  } catch (e) {
    console.error("[forgot-password] No se pudieron invalidar tokens previos:", e.message)
  }

  const resetToken = rand() + rand() + rand()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  await Token.insert({
    id: rand(),
    user_id: user.id,
    token: resetToken,
    type: "password_reset",
    used: false,
    expires_at: expiresAt,
    created_at: new Date(),
  })

  const resetLink = `${APP_URL}/reset-password?token=${resetToken}`

  try {
    const emailService = require("../../../components/email-service")
    emailService
      .sendPasswordResetEmail({
        email: normalizedEmail,
        name: user.name || "Socio",
        resetToken,
        resetLink,
      })
      .catch((err) => console.error("[forgot-password] Error enviando email (async):", err.message))
  } catch (emailErr) {
    console.error("[forgot-password] Error enviando email:", emailErr.message)
  }

  return res.json(success({ msg: "Si el email está registrado, recibirás las instrucciones." }))
}
