import db from "../../../components/db"
import lib from "../../../components/lib"

const { ReactivationRequest, User, Tree, AuditLog } = db
const { error, success, midd } = lib

const getHandler = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  
  let query = {}
  if (status && status !== 'all') {
    query.status = status
  }
  
  const skip = (parseInt(page) - 1) * parseInt(limit)
  
  const total = await ReactivationRequest.count(query)
  const items = await ReactivationRequest.find(query, { sort: { created_at: -1 }, skip, limit: parseInt(limit) })
  
  return res.json(success({
    items,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit))
  }))
}

const postHandler = async (req, res) => {
  const { action, request_id, admin_id, new_sponsor_code } = req.body
  
  if (!request_id) return res.json(error('ID de solicitud requerido'))
  
  const reactivationReq = await ReactivationRequest.findOne({ id: request_id })
  if (!reactivationReq) return res.json(error('Solicitud no encontrada'))
  
  if (reactivationReq.status !== 'pending') {
    return res.json(error('Esta solicitud ya fue procesada'))
  }
  
  const user = await User.findOne({ id: reactivationReq.user_id })
  if (!user) return res.json(error('Usuario no encontrado'))

  if (action === 'reject') {
    await ReactivationRequest.update({ id: request_id }, { 
      status: 'rejected', 
      updated_at: new Date() 
    })
    return res.json(success({ msg: 'Solicitud rechazada' }))
  }
  
  if (action === 'approve') {
    // Actualizar usuario
    await User.update({ id: user.id }, {
      status: 'active',
      blocked_at: null,
      statusReason: null,
      unblocked_at: new Date()
    })
    
    // Marcar solicitud
    await ReactivationRequest.update({ id: request_id }, { 
      status: 'approved',
      updated_at: new Date() 
    })
    
    // Log
    await AuditLog.insert({
      id: lib.rand() + lib.rand(),
      date: new Date(),
      admin_id,
      action: 'unblock_approved',
      collection_name: 'users',
      target_id: user.id,
      details: { 
        request_id 
      }
    })
    
    return res.json(success({ msg: 'Usuario desbloqueado con éxito' }))
  }
  
  return res.json(error('Acción no válida'))
}

export default async (req, res) => {
  await midd(req, res)
  if (req.method === 'GET') return getHandler(req, res)
  if (req.method === 'POST') return postHandler(req, res)
  return res.json(error('Method not allowed'))
}
