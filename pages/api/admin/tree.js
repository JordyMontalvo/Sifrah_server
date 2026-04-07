import db from "../../../components/db"
import lib from "../../../components/lib"

const { Tree, User, Closed } = db
const { success, midd, map, error } = lib

let tree, users, is_found

function getClosedUsersList(lastClosed) {
  if (!lastClosed) return []
  if (Array.isArray(lastClosed.users)) return lastClosed.users
  const dataUsers = lastClosed.data && Array.isArray(lastClosed.data.users) ? lastClosed.data.users : []
  return dataUsers
}

function getUserIdFromClosedEntry(u) {
  if (!u) return null
  return u.user_id || u.userId || u.id || null
}

function normalizeRankFromClosedEntry(u) {
  const r = u && u.rank != null ? String(u.rank).trim() : ""
  return r || null
}


function find(id, n) {

  if(n == 100) return

  const node = tree.find(e => e.id == id)


  if(node.childs.length == 0) return


  node.childs.forEach(_id => {
    find(_id, n+1)
  })

  node._childs = []

  node.childs.forEach(_id => {
    const _node = tree.find(e => e.id == _id)
    node._childs.push(_node)
  })
}


function found(id, __id) {
  const node = tree.find(e => e.id == id)

  node.childs.forEach(_id => {
    if(_id == __id) is_found = true

    found(_id, __id)
  })
}

export default async (req, res) => {
  await midd(req, res)

  tree  = await Tree.find({})

  users = await User.find({ tree: true })

  // Tomar el último cierre para reflejar el rango “real” (según cierre) en la red.
  // Nota: el cierre puede guardar `users` en raíz o dentro de `data.users` según implementación.
  let lastClosed = null
  try {
    lastClosed = await Closed.findOne({}, { sort: { date: -1 } })
  } catch (e) {
    lastClosed = null
  }
  const closedUsers = getClosedUsersList(lastClosed)
  const lastClosedRankByUserId = new Map()
  for (const cu of closedUsers) {
    const id = getUserIdFromClosedEntry(cu)
    const rank = normalizeRankFromClosedEntry(cu)
    if (id && rank) lastClosedRankByUserId.set(String(id), rank)
  }

  tree.forEach(node => {
    const user = users.find(e => e.id == node.id)
    // node.name = user.name + ' ' + user.lastName
    if (user) {
      node.name = user.name
      node.lastName = user.lastName
      node.dni  = user.dni
      node.affiliated = user.affiliated
      node.activated = user.activated
      node._activated = user._activated
      node.points = user.points
      node.affiliation_points = user.affiliation_points
      // Priorizar rango del último cierre; fallback al rango del usuario.
      node.rank = lastClosedRankByUserId.get(String(user.id)) || user.rank || "none"
    }
  })

  if(req.method == 'GET') {
    console.log('GET ...')
    // get tree

    find('5f0e0b67af92089b5866bcd0', 0)

    const node = tree.find(e => e.id == '5f0e0b67af92089b5866bcd0')
    console.log(node)

    // response
    return res.json(success({
      node
    }))
  }

  if(req.method == 'POST') {
    // console.log('POST ...')
    const { to: _to, from: _from } = req.body

    const to   = tree.find(e => e.dni == _to)   ; console.log({ to })
    const from = tree.find(e => e.dni == _from) ; console.log({ from })

    if(!to)   return res.json(error(`no existe ${_to} en el árbol`))
    if(!from) return res.json(error(`no existe ${_from} en el árbol`))

    // validate
    is_found = false
    found(to.id, from.id)

    if(is_found) return res.json(error(`movimiento inválido`))

    // move

    const parent_to = tree.find(e => e.id == to.parent) /*; console.log({ parent_to })*/

    const i = parent_to.childs.indexOf(to.id) /*; console.log({ i })*/
    parent_to.childs.splice(i, 1) /*; console.log({ parent_to })*/

    await Tree.update({ id: parent_to.id}, {
      childs: parent_to.childs
    })

    from.childs.push(to.id) /*; console.log({ from })*/

    await Tree.update({ id: from.id}, {
      childs: from.childs
    })

    to.parent = from.id /*; console.log({ to })*/

    await Tree.update({ id: to.id}, {
      parent: to.parent
    })

    // Actualizar los puntos del padre anterior (si existe)
    if (parent_to && parent_to.id) {
      await lib.updateTotalPointsCascade(User, Tree, parent_to.id)
    }

    // Actualizar los puntos del nuevo padre
    if (from && from.id) {
      await lib.updateTotalPointsCascade(User, Tree, from.id)
    }

    return res.json(success())
  }
}
