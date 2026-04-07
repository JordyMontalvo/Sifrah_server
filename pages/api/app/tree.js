import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Tree, Activation } = db
const { error, success, midd, map } = lib

let tree, nodes

const pos = {
  'none':             -1,
  'active':            0,
  'star':              1,
  'master':            2,
  'silver':            3,
  'gold':              4,
  'sapphire':          5,
  'RUBI':              6,
  'DIAMANTE':          7,
  'DOBLE DIAMANTE':    8,
  'TRIPLE DIAMANTE':   9,
  'DIAMANTE ESTRELLA': 10,
}


function calc_range(arr, p) {

  const n = arr.length

  if(n >= 4 && arr.reduce((a, b, c) => a + (b > (c == 0 ? 0.2619 : 0.25)   * 21000 ? (c == 0 ? 0.2619 : 0.25)   * 21000 : b), 0) >= 21000) return 'RUBI'
  if(n >= 4 && arr.reduce((a, b, c) => a + (b > (c == 0 ? 0.2768 : 0.25)   * 9000  ? (c == 0 ? 0.2768 : 0.25)   * 9000  : b), 0) >= 9000)  return 'sapphire'
  if(n >= 3 && arr.reduce((a, b, c) => a + (b > (c == 0 ? 0.3637 : 0.3334) * 3300  ? (c == 0 ? 0.3637 : 0.3334) * 3300  : b), 0) >= 3300)  return 'gold'
  if(n >= 3 && arr.reduce((a, b, c) => a + (b > (c == 0 ? 0.4167 : 0.3334) * 1800  ? (c == 0 ? 0.4167 : 0.3334) * 1800  : b), 0) >= 1800)  return 'silver'
  if(n >= 2 && arr.reduce((a, b, c) => a + (b > (c == 0 ? 0.5556 : 0.50)   * 900   ? (c == 0 ? 0.5556 : 0.50)   * 900   : b), 0) >= 900 )  return 'master'
  if(n >= 2 && arr.reduce((a, b, c) => a + (b > (c == 0 ? 0.6667 : 0.50)   * 300   ? (c == 0 ? 0.6667 : 0.50)   * 300   : b), 0) >= 300 )  return 'star'

  return 'active'
}

function rank(node) {
  if(node.activated) node.rank = calc_range(node.total, node.points)
  else node.rank = 'none'
}

function find_rank(id, name) {
  const node = tree.find(e => e.id == id)

  const i = pos[node.rank]
  const j = pos[name]

  if(i >= j) return true

  for (let _id of node.childs) {
    if(find_rank(_id, name)) return true
  }

  return false
}

function is_rank(node, rank) {

  let total = 0, M, M1, M2

  const n = node.childs.length

  const arr = node.total

  // if (rank == 'RUBI')              { M  =  21000; M1 =  5500; M2 =  5250 }
  if (rank == 'DIAMANTE')          { M  =  60000; M1 = 13000; M2 = 12000 }
  if (rank == 'DOBLE DIAMANTE')    { M  = 115000; M1 = 23000; M2 = 23000 }
  if (rank == 'TRIPLE DIAMANTE')   { M  = 225000; M1 = 37500; M2 = 37500 }
  if (rank == 'DIAMANTE ESTRELLA') { M  = 520000; M1 = 87000; M2 = 86700 }

  for(const [i, a] of arr.entries()) {
    if(i == 0) total += arr[i] > M1 ? M1 : arr[i]
    if(i >= 1) total += arr[i] > M2 ? M2 : arr[i]
  }

  let count = 0

  // if (rank == 'RUBI')              for (const _id of node.childs) if(find_rank(_id, 'gold'))     count += 1
  if (rank == 'DIAMANTE')          for (const _id of node.childs) if(find_rank(_id, 'sapphire')) count += 1
  if (rank == 'DOBLE DIAMANTE')    for (const _id of node.childs) if(find_rank(_id, 'RUBI'))     count += 1
  if (rank == 'TRIPLE DIAMANTE')   for (const _id of node.childs) if(find_rank(_id, 'RUBI'))     count += 1
  if (rank == 'DIAMANTE ESTRELLA') for (const _id of node.childs) if(find_rank(_id, 'DIAMANTE')) count += 1

  // if (rank == 'RUBI')              if(total >= M && n >= 4 && count >= 3) return true
  if (rank == 'DIAMANTE')          if(total >= M && n >= 5 && count >= 4) return true
  if (rank == 'DOBLE DIAMANTE')    if(total >= M && n >= 5 && count >= 4) return true
  if (rank == 'TRIPLE DIAMANTE')   if(total >= M && n >= 6 && count >= 5) return true
  if (rank == 'DIAMANTE ESTRELLA') if(total >= M && n >= 6 && count >= 5) return true

  return false
}

function next_rank(node) {

  let total = 0

  if(node.rank == 'none')   total = 0
  if(node.rank == 'active') total = node.total.reduce((a, b)    => a + b, 0)
  if(node.rank == 'star')   total = node.total.reduce((a, b, c) => a + (b > (c == 0 ? 0.6667 : 0.50) * 300  ? (c == 0 ? 0.6667 : 0.50) * 300  : b), 0)
  if(node.rank == 'master') total = node.total.reduce((a, b, c) => a + (b > (c == 0 ? 0.5556 : 0.50) * 900  ? (c == 0 ? 0.5556 : 0.50) * 900  : b), 0)
  if(node.rank == 'silver') total = node.total.reduce((a, b, c) => a + (b > (c == 0 ? 0.4167 : 0.3334) * 1800 ? (c == 0 ? 0.4167 : 0.3334) * 1800 : b), 0)
  if(node.rank == 'gold')   total = node.total.reduce((a, b, c) => a + (b > (c == 0 ? 0.3637 : 0.3334) * 3300 ? (c == 0 ? 0.3637 : 0.3334) * 3300 : b), 0)
  if(node.rank == 'sapphire') total = node.total.reduce((a, b, c) => a + (b > (c == 0 ? 0.2768 : 0.25)   * 9000 ? (c == 0 ? 0.2768 : 0.25)   * 9000 : b), 0)


  total = 0
  let M, M1, M2

  const n = node.childs.length

  const arr = node.total

  if (rank == 'RUBI')              { M  =  21000; M1 =  5500; M2 =  5250 }
  if (rank == 'DIAMANTE')          { M  =  60000; M1 = 13000; M2 = 12000 }
  if (rank == 'DOBLE DIAMANTE')    { M  = 115000; M1 = 23000; M2 = 23000 }
  if (rank == 'TRIPLE DIAMANTE')   { M  = 225000; M1 = 37500; M2 = 37500 }
  if (rank == 'DIAMANTE ESTRELLA') { M  = 520000; M1 = 87000; M2 = 86700 }

  for(const [i, a] of arr.entries()) {
    if(i == 0) total += arr[i] > M1 ? M1 : arr[i]
    if(i >= 1) total += arr[i] > M2 ? M2 : arr[i]
  }


  let next = ''
  let d = 0

  if(node.rank == 'none')   { next = 'active';   d = 90   - total }
  if(node.rank == 'active') { next = 'star';     d = 300  - total }
  if(node.rank == 'star')   { next = 'master';   d = 900  - total }
  if(node.rank == 'master') { next = 'silver';   d = 1800 - total }
  if(node.rank == 'silver') { next = 'gold';     d = 3300 - total }
  if(node.rank == 'gold')   { next = 'sapphire'; d = 9000 - total }
  if(node.rank == 'sapphire')          { next = 'RUBI';              d =  21000 - total }
  if(node.rank == 'RUBI')              { next = 'DIAMANTE';          d =  60000 - total }
  if(node.rank == 'DIAMANTE')          { next = 'DOBLE DIAMANTE';    d = 115000 - total }
  if(node.rank == 'DOBLE DIAMANTE')    { next = 'TRIPLE DIAMANTE';   d = 225000 - total }
  if(node.rank == 'TRIPLE DIAMANTE')   { next = 'DIAMANTE ESTRELLA'; d = 520000 - total }

  if(d < 0) d = 0

  node.next_rank = {
    name:   next,
    points: d,
  }
}


function total_points(id) {

  const node = tree.find(e => e.id == id)

  // Sumar puntos de activaciones Y afiliaciones
  node.total_points = node.points + (node.affiliation_points || 0)

  node.childs.forEach(_id => {
    node.total_points += total_points(_id)
  })

  return node.total_points
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

  // Buscar el nodo solicitado
  const node = await Tree.findOne({ id })
  if (!node) return res.json(error('node not found'))

  // Traer datos de usuario para el nodo
  const nodeUser = await User.findOne({ id: node.id })

  // Leer el total_points ya almacenado
  const total_points = nodeUser.total_points || 0

  // Traer los hijos inmediatos
  let children = []
  let children_points = []
  if (node.childs && node.childs.length > 0) {
    // Buscar los nodos hijos
    const childNodes = await Tree.find({ id: { $in: node.childs } })
    // Traer los usuarios de los hijos
    const childUsers = await User.find({ id: { $in: node.childs } })
    // Ordenar childNodes y childUsers según el orden de node.childs
    const childNodesOrdered = node.childs.map(cid => childNodes.find(n => n.id === cid))
    const childUsersOrdered = node.childs.map(cid => childUsers.find(u => u.id === cid))
    // Mapear hijos con datos de usuario
    children = childNodesOrdered.map((childNode, idx) => {
      const childUser = childUsersOrdered[idx] || {}
      return {
        id: childNode.id,
        childs: childNode.childs,
        name: childUser.name,
        lastName: childUser.lastName,
        affiliated: childUser.affiliated,
        activated: childUser.activated,
        points: Number(childUser.points) || 0,
        affiliation_points: childUser.affiliation_points || 0,
        photo: childUser.photo,
        country: childUser.country,
        dni: childUser.dni,
        phone: childUser.phone,
        email: childUser.email,
        _rank: childUser.rank,
      }
    })
    // Calcular los puntos grupales de cada hijo directo en el mismo orden
    children_points = childUsersOrdered.map(childUser => childUser && childUser.total_points || 0)
  }

  // Nodo principal con datos de usuario
  const mainNode = {
    id: node.id,
    childs: node.childs,
    name: nodeUser.name,
    lastName: nodeUser.lastName,
    affiliated: nodeUser.affiliated,
    activated: nodeUser.activated,
    points: Number(nodeUser.points) || 0,
    affiliation_points: nodeUser.affiliation_points || 0,
    photo: nodeUser.photo,
    country: nodeUser.country,
    dni: nodeUser.dni,
    phone: nodeUser.phone,
    email: nodeUser.email,
    _rank: nodeUser.rank,
    total_points,
  }

  return res.json(success({
    node: mainNode,
    children,
    children_points,
  }))
}
