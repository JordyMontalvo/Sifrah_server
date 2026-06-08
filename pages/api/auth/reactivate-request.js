import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, ReactivationRequest } = db
const { error, success, midd } = lib

const ReactivateRequest = async (req, res) => {
  const { dni, reason, sponsor_code } = req.body

  if (!dni) return res.json(error('DNI es requerido'))
  if (!reason || reason.trim() === '') return res.json(error('Debes proporcionar un motivo'))

  // Verificar que el usuario exista y esté bloqueado
  const user = await User.findOne({ dni })
  if (!user) return res.json(error('Usuario no encontrado'))
  if (user.status !== 'blocked') return res.json(error('Este usuario no está bloqueado'))

  // Validar patrocinador si se proporcionó
  let new_sponsor = null
  if (sponsor_code && sponsor_code.trim() !== '') {
    new_sponsor = await User.findOne({ token: sponsor_code.trim().toUpperCase() })
    if (!new_sponsor) return res.json(error('El código de patrocinador no es válido'))
  }

  // Comprobar si ya existe una solicitud pendiente
  const existingReq = await ReactivationRequest.findOne({ user_id: user.id, status: 'pending' })
  if (existingReq) {
    return res.json(error('Ya tienes una solicitud de reactivación pendiente. Espera a que el administrador la revise.'))
  }

  // Crear la solicitud
  const newRequest = {
    id: lib.rand() + lib.rand(),
    user_id: user.id,
    dni: user.dni,
    name: user.name,
    lastName: user.lastName,
    reason: reason.trim(),
    new_sponsor_code: sponsor_code ? sponsor_code.trim().toUpperCase() : null,
    new_sponsor_id: new_sponsor ? new_sponsor.id : null,
    status: 'pending', // pending, approved, rejected
    created_at: new Date(),
    updated_at: new Date()
  }

  await ReactivationRequest.insert(newRequest)

  return res.json(success({ 
    msg: 'Tu solicitud ha sido enviada con éxito. Será evaluada por el administrador.' 
  }))
}

export default async (req, res) => { await midd(req, res); return ReactivateRequest(req, res) }
