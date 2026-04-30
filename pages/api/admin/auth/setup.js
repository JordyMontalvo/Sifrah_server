import bcrypt from "bcrypt"
import db from "../../../../components/db"
import lib from "../../../../components/lib"

const { User } = db
const { success, error, midd } = lib

// ENDPOINT DIAGNÓSTICO - ELIMINAR DESPUÉS
const handler = async (req, res) => {
  if (req.method !== 'POST') return res.json(error('method not allowed'))
  const { secret, action, password } = req.body || {}
  if (secret !== 'setup-sifrah-2024') return res.json(error('unauthorized'))

  // Diagnóstico: listar todos los usuarios que ve el servidor
  if (action === 'list') {
    const users = await User.find({})
    return res.json({
      dbName: process.env.DB_NAME || 'sifrah (default)',
      dbUrl: (process.env.DB_URL || process.env.MONGODB_URI || 'localhost').replace(/:\/\/.*@/, '://***@'),
      totalUsers: users.length,
      users: users.map(u => ({ dni: u.dni, email: u.email, type: u.type }))
    })
  }

  // Crear admin en la DB correcta
  if (action === 'create') {
    const existing = await User.findOne({ dni: 'ADMIN' })
    if (existing) {
      return res.json({ already: true, msg: 'Admin ya existe', type: existing.type })
    }
    const hashed = await bcrypt.hash(password || 'sifrah2024', 12)
    await User.insert({
      id: 'admin', dni: 'ADMIN', name: 'Administrador',
      email: 'admin@sifrah.com', password: hashed,
      type: 'admin', affiliated: true, activated: true,
      plan: 'admin', date: new Date()
    })
    return res.json(success({ msg: 'Admin creado' }))
  }

  return res.json(error('action requerido: list o create'))
}

export default async (req, res) => { await midd(req, res); return handler(req, res) }
