import { ObjectId } from "mongodb"
import db from "../../../components/db"
import lib from "../../../components/lib"

const { Session } = db
const { error, success, midd } = lib

const SessionsHandler = async (req, res) => {
  let currentSessionValue = req.headers.authorization || req.body.session || req.query.session;
  if (!currentSessionValue) return res.json(error('invalid session'))

  const sessionObj = await Session.findOne({ value: currentSessionValue })
  if(!sessionObj) return res.json(error('invalid session'))

  if (req.method === 'GET') {
    const sessions = await Session.find({ id: sessionObj.id })
    const mappedSessions = sessions.map(s => ({
      _id: s._id,
      ip: s.ip || 'Desconocida',
      user_agent: s.user_agent || 'Desconocido',
      os: s.os || 'Desconocido',
      browser: s.browser || 'Desconocido',
      created_at: s.created_at,
      last_active: s.last_active,
      is_current: s.value === currentSessionValue
    }))
    
    return res.json(success({ sessions: mappedSessions }))
  }

  if (req.method === 'POST') {
    const { action, session_id_to_delete } = req.body
    
    if (action === 'delete') {
      const sessionToDelete = await Session.findOne({ _id: ObjectId(session_id_to_delete) })
      if (!sessionToDelete || sessionToDelete.id !== sessionObj.id) {
        return res.json(error('Acción no permitida'))
      }
      
      await Session.delete({ _id: ObjectId(session_id_to_delete) })
      return res.json(success({ msg: 'Sesión cerrada exitosamente' }))
    }
  }
}

export default async (req, res) => { await midd(req, res); return SessionsHandler(req, res) }
