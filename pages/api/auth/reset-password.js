import db from "../../../components/db"
import lib from "../../../components/lib"
import bcrypt from "bcrypt"

const { User, Token } = db
const { error, success, midd } = lib

export default async (req, res) => {
  await midd(req, res)

  if (req.method !== 'POST') return res.status(405).json(error('method not allowed'))

  const { token, password } = req.body || {}

  if (!token || typeof token !== 'string') {
    return res.json(error('Token inválido o expirado'))
  }

  if (!password || password.length < 8) {
    return res.json(error('La contraseña debe tener al menos 8 caracteres'))
  }

  // Buscar el token en la DB
  const tokenDoc = await Token.findOne({ token, type: 'password_reset', used: false })

  if (!tokenDoc) {
    return res.json(error('El enlace de recuperación no es válido o ya fue utilizado'))
  }

  // Verificar que no haya expirado
  if (new Date(tokenDoc.expires_at) < new Date()) {
    return res.json(error('El enlace de recuperación ha expirado. Solicita uno nuevo.'))
  }

  // Buscar el usuario
  const user = await User.findOne({ id: tokenDoc.user_id })
  if (!user) {
    return res.json(error('Usuario no encontrado'))
  }

  // Hashear la nueva contraseña
  const hashedPassword = await bcrypt.hash(password, 12)

  // Actualizar contraseña del usuario
  await User.update({ id: user.id }, { password: hashedPassword })

  // Invalidar el token usado
  await Token.update({ id: tokenDoc.id }, { used: true, used_at: new Date() })

  console.log(`[reset-password] Contraseña actualizada para usuario ${user.id} (DNI: ${user.dni})`)

  return res.json(success({ msg: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' }))
}
