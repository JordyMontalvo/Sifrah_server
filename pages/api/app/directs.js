const cors = require('micro-cors')()

import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Affiliation, Tree } = db
const { error, success, _ids, _map, model } = lib

// models
// const D = ['id', 'name', 'lastName', 'email', 'phone', 'affiliated', 'activated', 'affiliationDate']
const D = ['id', 'name', 'lastName', 'affiliated', 'activated', 'tree', 'email', 'phone', 'points']


const directs = async (req, res) => {

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // get USER
  const user = await User.findOne({ id: session.id })

  // find directs
  let directs = await User.find({ parentId: user.id })

  directs = directs.map(direct => {
    const d = model(direct, D)
    // Asegurar que points siempre sea un número (puntos personales)
    // Obtener points del modelo o directamente del objeto original
    d.points = Number(d.points !== undefined ? d.points : direct.points) || 0
    return { ...d }
  })

  const node = await Tree.findOne({ id: user.id })
  console.log({ node })

  const childs = node.childs
  console.log({ childs })

  let frontals = await User.find({ id: { $in: childs } })
  // frontals = frontals.filter(e => e.parentId != user.id)
  console.log({ frontals })

  frontals = frontals.map(frontal => {
    const d = model(frontal, D)
    // Asegurar que points siempre sea un número (puntos personales)
    // Obtener points del modelo o directamente del objeto original
    d.points = Number(d.points !== undefined ? d.points : frontal.points) || 0
    return { ...d }
  })

  // response
  return res.json(success({
    name:       user.name,
    lastName:   user.lastName,
    affiliated: user.affiliated,
    _activated: user._activated,
    activated:  user.activated,
    plan:       user.plan,
    country:    user.country,
    photo:      user.photo,
    tree:       user.tree,
    token:      user.token,

    id:       user.id,
    directs,
    frontals,
    // branch:   user.branch,
    // childs,
    // names,
  }))
}

module.exports = cors(directs)
