import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Transaction, Tree, Banner } = db
const { error, success, acum, midd } = lib


let tree, r

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

function total_points(id) {

  const node = tree.find(e => e.id == id)

  if(!node) return

  node.total_points = node.points + node.affiliation_points

  node.childs.forEach(_id => {
    node.total_points += total_points(_id)
  })

  return node.total_points
}

function total_affiliates(id, parent_id) {

  const node = tree.find(e => e.id == id)

  node.total_affiliates = (node.affiliated && node.parentId == parent_id && !node.closed) ? 1 : 0

  node.childs.forEach(_id => {
    node.total_affiliates += total_affiliates(_id, parent_id)
  })

  return node.total_affiliates
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

  if(node.rank == 'none')     total = 0
  if(node.rank == 'active')   total = node.total.reduce((a, b)    => a + b, 0)
  if(node.rank == 'star')     total = node.total.reduce((a, b, c) => a + (b > (c == 0 ? 0.6667 : 0.50)   * 300  ? (c == 0 ? 0.6667 : 0.50)   * 300  : b), 0)
  if(node.rank == 'master')   total = node.total.reduce((a, b, c) => a + (b > (c == 0 ? 0.5556 : 0.50)   * 900  ? (c == 0 ? 0.5556 : 0.50)   * 900  : b), 0)
  if(node.rank == 'silver')   total = node.total.reduce((a, b, c) => a + (b > (c == 0 ? 0.4167 : 0.3334) * 1800 ? (c == 0 ? 0.4167 : 0.3334) * 1800 : b), 0)
  if(node.rank == 'gold')     total = node.total.reduce((a, b, c) => a + (b > (c == 0 ? 0.3637 : 0.3334) * 3300 ? (c == 0 ? 0.3637 : 0.3334) * 3300 : b), 0)
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


export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  // valid session
      session = await Session.findOne({ value: session })
  if(!session)  return res.json(error('invalid session'))

  // get USER
  const user = await User.findOne({ id: session.id })

  // get transactions
  const transactions        = await Transaction.find({ user_id: user.id, virtual: {$in: [null, false]} })
  const virtualTransactions = await Transaction.find({ user_id: user.id, virtual:              true    })

  const ins         = acum(transactions,        {type: 'in' }, 'value')
  const outs        = acum(transactions,        {type: 'out'}, 'value')
  const insVirtual  = acum(virtualTransactions, {type: 'in' }, 'value')
  const outsVirtual = acum(virtualTransactions, {type: 'out'}, 'value')


  const users = await User.find({ tree: true })
        tree  = await Tree.find({})

  tree.forEach(node => {
    const user = users.find(e => e.id == node.id)
    node.name               = user.name + ' ' + user.lastName
    node.points             = Number(user.points)
    node.affiliation_points = user.affiliation_points ? user.affiliation_points : 0
    node.affiliated         = user.affiliated
    node.activated          = user.activated
    node.parentId           = user.parentId
    node.closed             = user.closed ? true : false
  })

  total_points(user.id)

  const node = tree.find(e => e.id == user.id)

  node.total = []

  node.childs.forEach(_id => {
    const _node = tree.find(e => e.id == _id)

    node.total.push(_node.total_points)
  })

  node.total.sort((a, b) => b - a)

  rank(node)

  // if(is_rank(node, 'RUBI'))              node.rank = 'RUBI'
  if(is_rank(node, 'DIAMANTE'))          node.rank = 'DIAMANTE'
  if(is_rank(node, 'DOBLE DIAMANTE'))    node.rank = 'DOBLE DIAMANTE'
  if(is_rank(node, 'TRIPLE DIAMANTE'))   node.rank = 'TRIPLE DIAMANTE'
  if(is_rank(node, 'DIAMANTE ESTRELLA')) node.rank = 'DIAMANTE ESTRELLA'

  next_rank(node)

  total_affiliates(user.id, user.id)

  let n_affiliates = 0

  if(user.plan == 'default') {
    node.childs.forEach(_id => {
      const _node = tree.find(e => e.id == _id)
      n_affiliates += _node.total_affiliates
    })
  }

  const banner = await Banner.findOne({})

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

    banner,
    ins,
    insVirtual,
    outs,
    balance: (ins - outs),
   _balance: (insVirtual - outsVirtual),
    rank:    user.rank,
    points:  user.points,
    node,
    n_affiliates,
  }))
}


// function total_affiliates(id, parent_id, n) {

//   const node = tree.find(e => e.id == id)

//   node.total_affiliates = 0

//   if(node.affiliated && !node.closeds) {
//     if(node.parentId == parent_id) node.total_affiliates = 1
//     else
//       if(n < 5) node.total_affiliates = 1
//   }

//   node.childs.forEach(_id => {
//     node.total_affiliates += total_affiliates(_id, parent_id, n+1)
//   })

//   return node.total_affiliates
// }
