import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Token } = db
const { error, success, midd, rand } = lib

// Tiempo de expiración del token: 1 hora
const TOKEN_TTL_MS = 60 * 60 * 1000

const APP_URL = process.env.APP_URL || 'https://sifrah.vercel.app'

import { applyCORS } from "../../../middleware/middleware-cors"

export default async (req, res) => {
  applyCORS(req, res)
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  await midd(req, res)

  if (req.method !== 'POST') return res.status(405).json(error('method not allowed'))

  const { email } = req.body || {}

  if (!email || typeof email !== 'string') {
    return res.json(error('El email es requerido'))
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Buscar usuario por email
  const user = await User.findOne({ email: normalizedEmail })

  // Siempre respondemos OK aunque no exista el email (evitar enumeración de usuarios)
  if (!user) {
    return res.json(success({ msg: 'Si el email está registrado, recibirás las instrucciones.' }))
  }

  // Invalidar tokens previos del mismo usuario
  const { MongoClient } = require('mongodb')
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const mongoDb = client.db(process.env.DB_NAME || 'sifrah')
  await mongoDb.collection('tokens').updateMany(
    { user_id: user.id, type: 'password_reset', used: false },
    { $set: { used: true } }
  )
  await client.close()

  // Generar token seguro
  const resetToken = rand() + rand() + rand()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  await Token.insert({
    id: rand(),
    user_id: user.id,
    token: resetToken,
    type: 'password_reset',
    used: false,
    expires_at: expiresAt,
    created_at: new Date(),
  })

  // Construir link de restablecimiento
  const resetLink = `${APP_URL}/reset-password?token=${resetToken}`

  // Enviar email via el servicio de email existente
  try {
    const emailService = require('../../../components/email-service')
    await emailService.sendPasswordResetEmail({
      email: normalizedEmail,
      name: user.name || 'Socio',
      resetToken,
      resetLink,
    })
  } catch (emailErr) {
    console.error('[forgot-password] Error enviando email:', emailErr.message)
    // No revelamos el error al usuario
  }

  return res.json(success({ msg: 'Si el email está registrado, recibirás las instrucciones.' }))
}
