import db from "../../../../components/db"
import lib from "../../../../components/lib"

const { User, Session } = db
const { rand, midd } = lib

// MAGIC LINK TEMPORAL - ELIMINAR DESPUÉS
const handler = async (req, res) => {
  try {
    const { secret } = req.query || {}
    if (secret !== 'sifrah-admin-2024') {
      res.statusCode = 403
      return res.end('Forbidden')
    }

    // Buscar admin por DNI simple
    const user = await User.findOne({ dni: 'ADMIN' })

    if (!user || user.type !== 'admin') {
      res.statusCode = 404
      return res.end(`Admin not found. Found: ${JSON.stringify(user ? { type: user.type, dni: user.dni } : null)}`)
    }

    // Crear sesión
    const sessionValue = rand() + rand() + rand()
    await Session.insert({
      id: user.id,
      value: sessionValue,
      kind: 'admin',
      createdAt: new Date(),
      userAgent: req.headers['user-agent'] || '',
      ip: ((req.headers['x-forwarded-for'] || '') + '').split(',')[0].trim()
    })

    const account = encodeURIComponent(JSON.stringify({
      id: user.id,
      dni: user.dni,
      name: user.name,
      email: user.email,
      type: user.type
    }))

    const redirectUrl = `https://sifrah-admin.vercel.app/login?token=${sessionValue}&account=${account}`

    // Redirect usando writeHead (compatible con Next.js)
    res.writeHead(302, { Location: redirectUrl })
    return res.end()

  } catch (err) {
    res.statusCode = 500
    return res.end(`Error: ${err.message}`)
  }
}

export default async (req, res) => { await midd(req, res); return handler(req, res) }
