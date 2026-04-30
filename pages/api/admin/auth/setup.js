import bcrypt from "bcrypt"
import db from "../../../../components/db"
import lib from "../../../../components/lib"

const { User } = db
const { success, error, midd } = lib

// ENDPOINT DE SETUP ÚNICO - ELIMINAR DESPUÉS DE USARLO
const handler = async (req, res) => {
  if (req.method !== 'POST') return res.json(error('method not allowed'))

  const { secret, password } = req.body || {}

  // Clave de seguridad para no dejar esto abierto
  if (secret !== 'setup-sifrah-2024') return res.json(error('unauthorized'))

  const adminPassword = password || 'sifrah2024'

  // Eliminar admin previo si existe (de runs anteriores en otra DB)
  try {
    const existing = await User.findOne({ dni: 'ADMIN' })
    if (existing) {
      return res.json({ already: true, msg: 'Admin ya existe en esta DB', email: existing.email, type: existing.type })
    }
  } catch(e) {}

  const hashed = await bcrypt.hash(adminPassword, 12)

  await User.insert({
    id: 'admin',
    dni: 'ADMIN',
    name: 'Administrador',
    email: 'admin@sifrah.com',
    password: hashed,
    type: 'admin',
    affiliated: true,
    activated: true,
    plan: 'admin',
    date: new Date()
  })

  return res.json(success({ msg: 'Admin creado correctamente en DB: sifrah', password: adminPassword }))
}

export default async (req, res) => { await midd(req, res); return handler(req, res) }
