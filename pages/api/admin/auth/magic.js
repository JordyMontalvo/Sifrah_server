import bcrypt from "bcrypt"
import db from "../../../../components/db"
import lib from "../../../../components/lib"

const { User, Session } = db
const { rand, error, midd } = lib

// MAGIC LINK TEMPORAL - ELIMINAR DESPUÉS
const handler = async (req, res) => {
  const { secret } = req.query || {}
  if (secret !== 'sifrah-admin-2024') {
    return res.status(403).send('Forbidden')
  }

  // Buscar admin
  const user = await User.findOne({
    $or: [{ dni: 'ADMIN' }, { id: 'admin' }, { email: 'admin@sifrah.com' }]
  })

  if (!user || user.type !== 'admin') {
    return res.status(404).send('Admin user not found')
  }

  // Crear sesión
  const sessionValue = rand() + rand() + rand()
  await Session.insert({
    id: user.id,
    value: sessionValue,
    kind: 'admin',
    createdAt: new Date(),
    userAgent: req.headers['user-agent'] || '',
    ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  })

  const account = encodeURIComponent(JSON.stringify({
    id: user.id,
    dni: user.dni,
    name: user.name,
    email: user.email,
    type: user.type
  }))

  // Redirigir al admin con el token en la URL
  return res.redirect(`https://sifrah-admin.vercel.app/login?token=${sessionValue}&account=${account}`)
}

export default async (req, res) => { await midd(req, res); return handler(req, res) }
