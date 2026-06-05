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
    // Definir el patrocinador
    let final_sponsor = null
    const code_to_check = new_sponsor_code || reactivationReq.new_sponsor_code
    
    if (code_to_check) {
      final_sponsor = await User.findOne({ token: code_to_check.trim().toUpperCase() })
      if (!final_sponsor) return res.json(error('El código de patrocinador no es válido'))
    }
    
    // Si no hay código nuevo y no envió uno originalmente, se queda con su parent actual
    // a menos que ya lo hayan reasignado al comprimir el árbol. En Sifrah la eliminación comprime el árbol.
    // El usuario fue reasignado, por lo que su parent actual en DB es válido, PERO podría querer uno nuevo.
    
    let parent_id_to_use = user.parentId
    if (final_sponsor) {
      parent_id_to_use = final_sponsor.id
    }
    
    // Si va a cambiar de patrocinador, actualizar el árbol
    if (final_sponsor && final_sponsor.id !== user.parentId) {
      // 1. Quitarlo de su padre actual
      const currentParentNode = await Tree.findOne({ id: user.parentId })
      if (currentParentNode && currentParentNode.childs) {
        const updatedChilds = currentParentNode.childs.filter(childId => childId !== user.id)
        await Tree.update({ id: user.parentId }, { childs: updatedChilds })
      }
      
      // 2. Agregarlo al nuevo padre
      const _id = final_sponsor.coverage && final_sponsor.coverage.id ? final_sponsor.coverage.id : final_sponsor.id
      let newParentNode = await Tree.findOne({ id: _id })
      if (newParentNode) {
        if (!newParentNode.childs.includes(user.id)) {
          newParentNode.childs.push(user.id)
          await Tree.update({ id: _id }, { childs: newParentNode.childs })
        }
      } else {
        await Tree.insert({ id: _id, childs: [user.id], parent: final_sponsor.id })
      }
      
      parent_id_to_use = final_sponsor.id
      
      // Actualizar el propio nodo del usuario
      const ownNode = await Tree.findOne({ id: user.id })
      if (ownNode) {
        await Tree.update({ id: user.id }, { parent: _id })
      } else {
        await Tree.insert({ id: user.id, childs: [], parent: _id })
      }
    }
    
    // Actualizar usuario
    await User.update({ id: user.id }, {
      status: 'active',
      eliminated_at: null,
      parentId: parent_id_to_use
    })
    
    // Marcar solicitud
    await ReactivationRequest.update({ id: request_id }, { 
      status: 'approved',
      final_sponsor_id: final_sponsor ? final_sponsor.id : null,
      updated_at: new Date() 
    })
    
    // Log
    await AuditLog.insert({
      id: lib.rand() + lib.rand(),
      date: new Date(),
      admin_id,
      action: 'reactivate_approved',
      collection_name: 'users',
      target_id: user.id,
      details: { 
        request_id, 
        changed_sponsor: final_sponsor ? true : false,
        new_sponsor_id: final_sponsor ? final_sponsor.id : null 
      }
    })
    
    return res.json(success({ msg: 'Usuario reactivado con éxito' }))
  }
  
  return res.json(error('Acción no válida'))
}

export default async (req, res) => {
  await midd(req, res)
  if (req.method === 'GET') return getHandler(req, res)
  if (req.method === 'POST') return postHandler(req, res)
  return res.json(error('Method not allowed'))
}
