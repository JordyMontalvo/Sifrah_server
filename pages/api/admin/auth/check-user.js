import db from "../../../../components/db"
import lib from "../../../../components/lib"

const { User } = db
const { success, error, midd } = lib

// ENDPOINT TEMPORAL DE DIAGNÓSTICO - ELIMINAR DESPUÉS DE VERIFICAR
const handler = async (req, res) => {
  if (req.method !== 'GET') return res.json(error('method not allowed'))
  
  const { dni, email } = req.query
  
  if (!dni && !email) {
    return res.json(error('Pasa ?dni=ADMIN o ?email=admin@sifrah.com'))
  }
  
  const query = dni ? { dni: String(dni).trim() } : { email: String(email).trim() }
  const user = await User.findOne(query)
  
  if (!user) {
    return res.json({ found: false, query })
  }
  
  return res.json({
    found: true,
    id: user.id,
    dni: user.dni,
    email: user.email,
    type: user.type,
    hasPassword: !!user.password,
    passwordStart: user.password ? user.password.substring(0, 7) : null
  })
}

export default async (req, res) => { await midd(req, res); return handler(req, res) }
