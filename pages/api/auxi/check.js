import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User  } = db
const { error, success, midd } = lib


const Check = async (req, res) => {

  // El valor llega del cliente y se usa como filtro de Mongo. Sin forzarlo a
  // string, un objeto como { "$ne": null } empareja a un usuario arbitrario y
  // el update de abajo le borra dni, phone y address.
  const raw = req.body && req.body.check
  const check = typeof raw === 'string' ? raw.trim() : ''

  // valid check string
  if(!check || check.length > 128) return res.json(error('invalid check string'))

  const user = await User.findOne({ check })
  if(!user) return res.json(error('invalid check string'))

  // valid verified user
  if(user.verified) return res.json(success())

  // update user
  await User.update({ id: user.id }, {
    verified:   true,
    affiliated: false,
    activated:  false,
    phone:   null,
    dni:     null,
    address: null,
  })

  // response
  return res.json(success())
}

export default async (req, res) => { await midd(req, res); return Check(req, res) }
