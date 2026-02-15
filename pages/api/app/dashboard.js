import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Transaction, Tree, Banner, Plan, DashboardConfig } = db
const { error, success, acum, midd, model } = lib

const D = ['id', 'name', 'lastName', 'affiliated', 'activated', 'tree', 'email', 'phone', 'address', 'rank', 'points', 'parentId', 'total_points']
export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query




  // valid session
  session = await Session.findOne({ value: session })
  if (!session) return res.json(error('invalid session'))

  // GET plans
  const plans = await Plan.find({}); // Traer todos los planes


  // get USER
  const user = await User.findOne({ id: session.id })

  let directs = await User.find({ parentId: user.id })

  directs = directs.map(direct => {
    const d = model(direct, D)
    return { ...d }
  })

  const node = await Tree.findOne({ id: user.id })
  console.log({ node })

  const childs = node.childs
  console.log({ childs })

  let frontals = await User.find({ id: { $in: childs } })
  // frontals = frontals.filter(e => e.parentId != user.id)
  console.log({ frontals })

  // get transactions
  const transactions = await Transaction.find({ user_id: user.id, virtual: { $in: [null, false] } })
  const virtualTransactions = await Transaction.find({ user_id: user.id, virtual: true })

  const ins = acum(transactions, { type: 'in' }, 'value')
  const outs = acum(transactions, { type: 'out' }, 'value')
  const insVirtual = acum(virtualTransactions, { type: 'in' }, 'value')
  const outsVirtual = acum(virtualTransactions, { type: 'out' }, 'value')


  const banner = await Banner.findOne({})

  // GET dashboard config (Bono Viaje text) - Primero buscar configuración específica del usuario
  let dashboardConfig = await DashboardConfig.findOne({ id: 'travel_bonus', userId: user.id })

  // Si no existe configuración específica del usuario, buscar la configuración global
  // (configuraciones que no tienen el campo userId)
  if (!dashboardConfig) {
    dashboardConfig = await DashboardConfig.findOne({
      id: 'travel_bonus',
      userId: { $exists: false }
    })
  }

  // Si no existe ninguna configuración, crear una global por defecto
  if (!dashboardConfig) {
    dashboardConfig = {
      id: 'travel_bonus',
      text: 'Tu progreso hacia el Bono Viaje se actualizará próximamente. ¡Sigue trabajando para alcanzar tus objetivos!'
    }
    await DashboardConfig.insert(dashboardConfig)
  }

  // get full tree for counting and rank calculations
  const allTree = await Tree.find({})
  const treeMap = allTree.reduce((a, b) => { a[b.id] = b; return a }, {})

  function countNetwork(id) {
    if (!treeMap[id]) return 0
    const node = treeMap[id]
    let count = 0
    if (node.childs) {
      node.childs.forEach(childId => {
        count += 1 + countNetwork(childId)
      })
    }
    return count
  }

  const n_affiliates_total = countNetwork(user.id)

  // Determine current provisional rank based on real performance
  const rankRequirements = {
    'star': { points: 300, childs: 2 },
    'master': { points: 900, childs: 2 },
    'silver': { points: 1800, childs: 3 },
    'gold': { points: 3300, childs: 3 },
    'sapphire': { points: 9000, childs: 4 },
    'RUBI': { points: 21000, childs: 4 },
    'DIAMANTE': { points: 60000, childs: 5 },
    'DOBLE DIAMANTE': { points: 115000, childs: 5 },
    'TRIPLE DIAMANTE': { points: 225000, childs: 6 },
    'DIAMANTE ESTRELLA': { points: 520000, childs: 6 }
  }

  const rankOrder = ['none', 'active', 'star', 'master', 'silver', 'gold', 'sapphire', 'RUBI', 'DIAMANTE', 'DOBLE DIAMANTE', 'TRIPLE DIAMANTE', 'DIAMANTE ESTRELLA']

  let provisionalRank = (user.activated || user._activated) ? 'active' : 'none'
  const currentTotalPoints = user.total_points || 0
  const currentDirects = directs.length || 0

  // Check highest met rank
  for (let i = 2; i < rankOrder.length; i++) {
    const rName = rankOrder[i]
    const req = rankRequirements[rName]
    if (currentTotalPoints >= req.points && currentDirects >= req.childs) {
      provisionalRank = rName
    } else {
      break // Doesn't meet this or higher
    }
  }

  const provisionalRankIndex = rankOrder.indexOf(provisionalRank)
  const nextRankName = provisionalRankIndex < rankOrder.length - 1 ? rankOrder[provisionalRankIndex + 1] : null

  let nextRankPercentage = 0
  if (nextRankName) {
    const req = rankRequirements[nextRankName] || (nextRankName === 'active' ? { points: 1, childs: 0 } : null)
    if (req) {
      if (nextRankName === 'active') {
        nextRankPercentage = (user.activated || user._activated) ? 100 : 0
      } else {
        const pointsProgress = Math.min(100, (currentTotalPoints * 100) / req.points)
        const childsProgress = Math.min(100, (currentDirects * 100) / req.childs)
        nextRankPercentage = Math.floor((pointsProgress + childsProgress) / 2)
      }
    }
  }

  // response
  return res.json(success({
    name: user.name,
    lastName: user.lastName,
    affiliated: user.affiliated,
    _activated: user._activated,
    activated: user.activated,
    plan: user.plan,
    country: user.country,
    photo: user.photo,
    tree: user.tree,
    email: user.email,
    token: user.token,
    address: user.address,
    directs,
    frontals,

    banner,
    ins,
    insVirtual,
    outs,
    balance: (ins - outs),
    _balance: (insVirtual - outsVirtual),
    rank: user.rank,
    points: user.points,
    plans,
    total_points: user.total_points, // <-- Agregar todos los planes a la respuesta
    travelBonusText: dashboardConfig.text || 'Tu progreso hacia el Bono Viaje se actualizará próximamente. ¡Sigue trabajando para alcanzar tus objetivos!',
    n_affiliates_total,
    nextRankName,
    nextRankPercentage,
    provisionalRank,
  }))
}
