import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Tree, Closed } = db
const { error, success, midd } = lib

let tree, users

async function fetchLastClosed() {
  const all = await Closed.find({})
  if (!all || !all.length) return null
  all.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  return all[0]
}

function getClosedUsersList(lastClosed) {
  if (!lastClosed) return []
  if (Array.isArray(lastClosed.users)) return lastClosed.users
  const dataUsers =
    lastClosed.data && Array.isArray(lastClosed.data.users) ? lastClosed.data.users : []
  return dataUsers
}

function getUserIdFromClosedEntry(u) {
  if (!u) return null
  return u.user_id || u.userId || u.id || null
}

function getUserDniFromClosedEntry(u) {
  if (!u) return null
  const d = u.dni != null ? String(u.dni).trim() : ""
  return d || null
}

function normalizeRankFromClosedEntry(u) {
  const r = u && u.rank != null ? String(u.rank).trim() : ""
  return r || null
}

let lastClosedRankByUserId = new Map()
let lastClosedRankByDni = new Map()

function find(id, n) {
  if(n == 100) return

  const node = tree.find(e => e.id == id)
  if(!node || node.childs.length == 0) return

  // Cargar hijos recursivamente
  node.childs.forEach(_id => {
    find(_id, n+1)
  })

  // Crear array de hijos con datos completos
  node._childs = []
  node.childs.forEach(_id => {
    const _node = tree.find(e => e.id == _id)
    if(_node) {
      // Encontrar datos del usuario
      const user = users.find(u => u.id === _id)
      if(user) {
        _node.name = user.name
        _node.lastName = user.lastName
        _node.affiliated = user.affiliated
        _node.activated = user.activated
        _node.points = Number(user.points) || 0
        _node.affiliation_points = user.affiliation_points || 0
        _node.photo = user.photo
        _node.country = user.country
        _node.dni = user.dni
        _node.phone = user.phone
        _node.email = user.email
        const closedRank = lastClosedRankByUserId.get(String(user.id)) || null
        const closedRankByDni = !closedRank && user.dni
          ? lastClosedRankByDni.get(String(user.dni))
          : null
        _node._rank = closedRank || closedRankByDni || user.rank
        _node.rank = closedRank || closedRankByDni || user.rank
        _node.total_points = user.total_points || 0
      }
      node._childs.push(_node)
    }
  })
}

export default async (req, res) => {
  await midd(req, res)

  let { session, id } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // get USER
  const user = await User.findOne({ id: session.id })

  // Si no se pasa id, usar el nodo raíz
  if (!id || id === 'null') id = user.id

  try {
    // Cargar TODO el árbol de una vez (como en admin)
    tree = await Tree.find({})
    
    // Cargar TODOS los usuarios de una vez
    users = await User.find({ tree: true })

    // Tomar el último cierre y mapear rangos por usuario
    let lastClosed = null
    try {
      lastClosed = await fetchLastClosed()
    } catch (e) {
      lastClosed = null
    }
    const closedUsers = getClosedUsersList(lastClosed)
    lastClosedRankByUserId = new Map()
    lastClosedRankByDni = new Map()
    for (const cu of closedUsers) {
      const uid = getUserIdFromClosedEntry(cu)
      const dni = getUserDniFromClosedEntry(cu)
      const rnk = normalizeRankFromClosedEntry(cu)
      if (uid && rnk) lastClosedRankByUserId.set(String(uid), rnk)
      if (dni && rnk) lastClosedRankByDni.set(String(dni), rnk)
    }

    // Encontrar el nodo raíz
    const rootNode = tree.find(e => e.id == id)
    if (!rootNode) return res.json(error('node not found'))

    // Cargar datos del usuario raíz
    const rootUser = users.find(u => u.id === id)
    if (rootUser) {
      rootNode.name = rootUser.name
      rootNode.lastName = rootUser.lastName
      rootNode.affiliated = rootUser.affiliated
      rootNode.activated = rootUser.activated
      rootNode.points = Number(rootUser.points) || 0
      rootNode.affiliation_points = rootUser.affiliation_points || 0
      rootNode.photo = rootUser.photo
      rootNode.country = rootUser.country
      rootNode.dni = rootUser.dni
      rootNode.phone = rootUser.phone
      rootNode.email = rootUser.email
      const closedRank = lastClosedRankByUserId.get(String(rootUser.id)) || null
      const closedRankByDni = !closedRank && rootUser.dni
        ? lastClosedRankByDni.get(String(rootUser.dni))
        : null
      rootNode._rank = closedRank || closedRankByDni || rootUser.rank
      rootNode.rank = closedRank || closedRankByDni || rootUser.rank
      rootNode.total_points = rootUser.total_points || 0
    }

    // Cargar TODOS los niveles recursivamente
    find(id, 0)

    // Obtener el nodo completo con todos sus hijos
    const completeNode = tree.find(e => e.id == id)

    return res.json(success({
      node: completeNode,
      totalNodes: tree.length,
      maxLevel: getMaxLevel(completeNode)
    }))

  } catch (err) {
    console.error('Error loading complete tree:', err)
    return res.json(error('Error loading tree'))
  }
}

function getMaxLevel(node, level = 0) {
  if (!node || !node._childs) return level
  
  let maxLevel = level
  node._childs.forEach(child => {
    maxLevel = Math.max(maxLevel, getMaxLevel(child, level + 1))
  })
  
  return maxLevel
} 