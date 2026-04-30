import bcrypt from "bcrypt"
import db from "../../../../components/db"
import lib from "../../../../components/lib"

const { User } = db
const { success, error, midd } = lib

export default async (req, res) => {
  await midd(req, res);
  if (req.method !== 'POST') return res.status(405).json(error('method not allowed'));

  const { secret, newPassword } = req.body || {}

  // Clave de seguridad para este endpoint
  if (secret !== 'sifrah-reset-2024') return res.status(403).json(error('unauthorized'));

  if (!newPassword || newPassword.length < 6) {
    return res.json(error('La nueva contraseña debe tener al menos 6 caracteres'));
  }

  const user = await User.findOne({ dni: 'ADMIN' });
  if (!user) return res.json(error('Usuario ADMIN no encontrado'));

  const hashed = await bcrypt.hash(newPassword, 12);
  
  await User.update({ id: user.id }, { password: hashed });

  return res.json(success({ msg: 'Contraseña actualizada correctamente para el usuario ADMIN' }));
}
