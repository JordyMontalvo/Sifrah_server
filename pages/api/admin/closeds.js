import db from "../../../components/db"
import lib from "../../../components/lib"
import path from "path"
import dotenv from "dotenv"
import fs from "fs"

dotenv.config({ path: path.resolve(process.cwd(), "../db/.env") })
dotenv.config({ path: path.resolve(process.cwd(), "./.env.local") })
dotenv.config({ path: path.resolve(process.cwd(), "./.env") })

const { Product, User, Session, Affiliation, Activation } = db
const { midd, success, rand } = lib

const { Tree, Transaction, Closed, Period, RankBonusPayment } = db

let tree

function buildPeriodKey(year, month) {
  const mm = String(month).padStart(2, "0")
  return `${year}-${mm}`
}

function nextMonthYear(year, month) {
  if (month === 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

function resolveYearMonthFromPeriod(period) {
  if (period?.year && period?.month) {
    return { year: Number(period.year), month: Number(period.month) }
  }

  if (period?.key && /^\d{4}-\d{2}$/.test(period.key)) {
    const [y, m] = period.key.split("-").map((v) => Number(v))
    return { year: y, month: m }
  }

  const ref = period?.createdAt ? new Date(period.createdAt) : new Date()
  return { year: ref.getFullYear(), month: ref.getMonth() + 1 }
}

async function closeActivePeriodAndOpenNext() {
  const now = new Date()
  const openPeriods = await Period.find({ status: "open" })
  if (!openPeriods || !openPeriods.length) {
    return { closedPeriod: null, nextPeriod: null, note: "No había periodo activo para cerrar" }
  }

  openPeriods.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  const activePeriod = openPeriods[0]

  await Period.update(
    { key: activePeriod.key },
    { status: "closed", closedAt: now }
  )
  const closedPeriod = await Period.findOne({ key: activePeriod.key })

  const { year, month } = resolveYearMonthFromPeriod(activePeriod)
  const { year: ny, month: nm } = nextMonthYear(year, month)
  const nextKey = buildPeriodKey(ny, nm)

  const existingNext = await Period.findOne({ key: nextKey })
  if (existingNext) {
    if (existingNext.status !== "open") {
      await Period.update(
        { key: nextKey },
        {
          status: "open",
          year: ny,
          month: nm,
          createdAt: now,
          closedAt: null,
        }
      )
    }
    const nextPeriod = await Period.findOne({ key: nextKey })
    return { closedPeriod, nextPeriod, note: null }
  }

  const MONTHS_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ]
  const nextPeriod = {
    id: rand(),
    key: nextKey,
    year: ny,
    month: nm,
    label: `${MONTHS_ES[nm - 1]} ${ny}`,
    status: "open",
    createdAt: now,
    closedAt: null,
  }
  await Period.insert(nextPeriod)

  return { closedPeriod, nextPeriod, note: null }
}

function buildLegDetails(previewTree, usersList, treeList) {
  const userById = new Map((usersList || []).map((u) => [u.id, u]))
  const treeById = new Map((treeList || []).map((n) => [n.id, n]))
  const memoTotals = new Map()

  const totalPoints = (id) => {
    if (!id) return 0
    if (memoTotals.has(id)) return memoTotals.get(id)

    const user = userById.get(id)
    const node = treeById.get(id)
    const own = Number(user?.points || 0) + Number(user?.affiliation_points || 0)
    let total = own

    for (const childId of (node?.childs || [])) {
      total += totalPoints(childId)
    }

    memoTotals.set(id, total)
    return total
  }

  return (previewTree || []).map((node) => {
    const sourceNode = treeById.get(node.id)
    const legs = (sourceNode?.childs || []).map((childId, index) => {
      const childUser = userById.get(childId)
      return {
        idx: index + 1,
        user_id: childId,
        dni: childUser?.dni || "",
        name: [childUser?.name, childUser?.lastName].filter(Boolean).join(" ").trim() || "Sin nombre",
        personal_points: Number(childUser?.points || 0) + Number(childUser?.affiliation_points || 0),
        total_points: totalPoints(childId),
      }
    })

    return {
      ...node,
      grouped_points_legs: legs,
    }
  })
}

const Pay = {
  'star':                 15,
  'master':               30,
  'silver':               45,
  'gold':                100,
  'sapphire':            200,
  'RUBI':                300,
  'DIAMANTE':           5000,
  'DOBLE DIAMANTE':    10000,
  'TRIPLE DIAMANTE':   15000,
  'DIAMANTE ESTRELLA': 25000,
}

const pays = [
  {
    'name' : 'star',
    'payed':  false,
  },
  {
    'name' : 'master',
    'payed':  false,
  },
  {
    'name' : 'silver',
    'payed':  false,
  },
  {
    'name' : 'gold',
    'payed':  false,
  },
  {
    'name' : 'sapphire',
    'payed':  false,
  },
  {
    'name' : 'RUBI',
    'payed':  false,
  },
  {
    'name' : 'DIAMANTE',
    'payed':  false,
  },
  {
    'name' : 'DOBLE DIAMANTE',
    'payed':  false,
  },
  {
    'name' : 'TRIPLE DIAMANTE',
    'payed':  false,
  },
  {
    'name' : 'DIAMANTE ESTRELLA',
    'payed':  false,
  },
]

let r = {
  'active':   [0.03, 0.01, 0.01                                                                          ],
  'star':     [0.05, 0.06, 0.08, 0.03, 0.005, 0.005                                                      ],
  'master':   [0.05, 0.06, 0.10, 0.07, 0.03,  0.01,  0.01, 0.005, 0.005                                  ],
  'silver':   [0.05, 0.06, 0.12, 0.10, 0.03,  0.01,  0.01, 0.01,  0.01, 0.005, 0.005                     ],
  'gold':     [0.05, 0.07, 0.13, 0.10, 0.03,  0.015, 0.01, 0.01,  0.01, 0.005, 0.005, 0.005, 0.005       ],
  'sapphire':          [0.06, 0.07, 0.13, 0.11, 0.04,  0.015, 0.01, 0.01,  0.01, 0.005, 0.005, 0.005, 0.005, 0.005],
  'RUBI':              [0.06, 0.07, 0.14, 0.11, 0.04,  0.015, 0.01, 0.01,  0.01,  0.01, 0.005, 0.005, 0.005, 0.005, 0.005],
  'DIAMANTE':          [0.07, 0.07, 0.14, 0.12, 0.05,  0.015, 0.01, 0.01,  0.01,  0.01, 0.005, 0.005, 0.005, 0.005, 0.005],
  'DOBLE DIAMANTE':    [0.07, 0.08, 0.15, 0.13, 0.05,  0.020, 0.02, 0.01,  0.01,  0.01, 0.005, 0.005, 0.005, 0.005, 0.005],
  'TRIPLE DIAMANTE':   [0.08, 0.10, 0.15, 0.13, 0.05,  0.020, 0.02, 0.01,  0.01,  0.01, 0.005, 0.005, 0.005, 0.005, 0.005],
  'DIAMANTE ESTRELLA': [0.08, 0.10, 0.16, 0.13, 0.05,  0.020, 0.02, 0.01,  0.01,  0.01, 0.005, 0.005, 0.005, 0.005, 0.005],
}

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

const bonuses = {
  gold: [],
  sapphire: [],
  ruby: [],
  diamond: [],
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

  if(node._activated || node.activated) node.rank = calc_range(node.total, node.points)
  else node.rank = 'none'

  node.childs.forEach(_id => {
    const _node = tree.find(e => e.id == _id)
    rank(_node)
  })
}


function levels() {
  for(let node of tree) {
    if(node.rank == 'DIAMANTE ESTRELLA') node.levels = 15
    if(node.rank == 'TRIPLE DIAMANTE')   node.levels = 15
    if(node.rank == 'DOBLE DIAMANTE')    node.levels = 15
    if(node.rank == 'DIAMANTE')   node.levels = 15
    if(node.rank == 'RUBI')       node.levels = 15
    if(node.rank == 'sapphire')   node.levels = 14
    if(node.rank == 'gold')   node.levels = 13
    if(node.rank == 'silver') node.levels = 11
    if(node.rank == 'master') node.levels = 9
    if(node.rank == 'star')   node.levels = 6
    if(node.rank == 'active') node.levels = 3
  }
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

  // if (rank == 'RUBI')              { M  =  21000; M1 =  5500; M2 =  5250 } /
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


function pay_residual(id, n, user) {

  if(n == 13) return

  let node = tree.find(e => e.id == id)
  let _id  = node.parent

  if(node._activated || node.activated) {

    let rr = node.activated ? 1 : 0.5

    if(node.levels > n) {
      node.residual_bonus += r[node.rank][n] * user.points * rr

      if(r[node.rank][n] * user.points * rr > 0) {
        node.residual_bonus_arr.push({
          n,
          dni:  user.dni,
          name: user.name,
          val:  user.points,
          r:    r[node.rank][n],
          rr,
          amount: r[node.rank][n] * user.points * rr
        })
      }
    }

    if(_id) pay_residual(_id, n+1, user)

  } else

    if(_id) pay_residual(_id, n, user)
}


export default async (req, res) => {
  await midd(req, res)

  if(req.method == 'GET') {

    let closeds = await Closed.find({})

    return res.json(success({ closeds }))
  }

  if(req.method == 'POST') { ; console.log('POST ...')

    const { action } = req.body

    if (action == 'new') { ; console.log('preview via Go Engine...')

      const { execSync } = require('child_process');
      const os   = require('os');

      try {
        const engineCwd  = path.resolve(process.cwd(), 'cierre_engine');
        const linuxBinaryPath = path.resolve(process.cwd(), 'cierre_engine/engine_linux');
        const useLinuxBinary = os.platform() === 'linux' && fs.existsSync(linuxBinaryPath);
        const engineCmd = useLinuxBinary ? `"${linuxBinaryPath}" --dry-run --json` : 'go run . --dry-run --json';

        // Map Node server DB vars → Go engine vars
        const goEnv = {
          ...process.env,
          DB_URL_PROD:  process.env.DB_URL_PROD  || process.env.DB_URL      || process.env.MONGODB_URI,
          DB_NAME_PROD: process.env.DB_NAME_PROD || process.env.DB_NAME     || 'sifrah',
          DB_URL_DEV:   process.env.DB_URL_DEV   || process.env.DB_URL      || process.env.MONGODB_URI,
          DB_NAME_DEV:  process.env.DB_NAME_DEV  || process.env.DB_NAME     || 'sifrah',
        };

        // Run with --dry-run and --json for preview
        const output = execSync(engineCmd, { 
          cwd: engineCwd,
          encoding: 'utf-8',
          env: goEnv
        });

        const result = JSON.parse(output);
        const usersList = await User.find({})
        const treeList = await Tree.find({})
        const enrichedTree = buildLegDetails(result.tree, usersList, treeList)

        const { enrichPreviewTreeWithRankBonuses } = require("../../../lib/applyRankBonusesOnClose")
        const closedsList = await Closed.find({})
        let rankPayDocs = []
        try {
          rankPayDocs = await RankBonusPayment.find({})
        } catch (e) {
          rankPayDocs = []
        }
        const treeWithRankBonuses = enrichPreviewTreeWithRankBonuses(
          enrichedTree,
          closedsList,
          rankPayDocs,
          usersList
        )

        return res.json(success({ 
          tree: treeWithRankBonuses, 
          virtual_resets: result.virtual_resets || [],
          affiliations: result.affiliations, 
          activations: result.activations 
        }));

      } catch (error) {
        console.error('❌ Error executing Go Engine (new):', error);
        return res.status(500).json({ error: 'Error al previsualizar el cierre con Go' });
      }

      /* Original JS logic preserved
      ...
      */
    }

    if (action == 'save') { ; console.log('save via Go Engine...')

      const { execSync } = require('child_process');
      const os   = require('os');

      try {
        const engineCwd  = path.resolve(process.cwd(), 'cierre_engine');
        const linuxBinaryPath = path.resolve(process.cwd(), 'cierre_engine/engine_linux');
        const useLinuxBinary = os.platform() === 'linux' && fs.existsSync(linuxBinaryPath);
        const engineCmd = useLinuxBinary ? `"${linuxBinaryPath}"` : 'go run .';

        const goEnv = {
          ...process.env,
          DB_URL_PROD:  process.env.DB_URL_PROD  || process.env.DB_URL      || process.env.MONGODB_URI,
          DB_NAME_PROD: process.env.DB_NAME_PROD || process.env.DB_NAME     || 'sifrah',
          DB_URL_DEV:   process.env.DB_URL_DEV   || process.env.DB_URL      || process.env.MONGODB_URI,
          DB_NAME_DEV:  process.env.DB_NAME_DEV  || process.env.DB_NAME     || 'sifrah',
        };

        // Execute the Go engine. stdout will capture the summary print.
        const output = execSync(engineCmd, { 
          cwd: engineCwd,
          encoding: 'utf-8',
          env: goEnv
        });

        console.log('✅ Go Engine output:', output);

        const periodResult = await closeActivePeriodAndOpenNext()

        const periodKey =
          periodResult.closedPeriod?.key ||
          buildPeriodKey(new Date().getFullYear(), new Date().getMonth() + 1)

        const { applyRankBonusesAfterGoClose } = require("../../../lib/applyRankBonusesOnClose")
        let rankBonuses = null
        try {
          rankBonuses = await applyRankBonusesAfterGoClose({
            periodKey,
            rand: () => rand(),
          })
        } catch (rankErr) {
          console.error("❌ Bonos por rango post-cierre Go:", rankErr)
          rankBonuses = { error: String(rankErr.message || rankErr) }
        }

        return res.json(success({ 
          message: 'Cierre completado con éxito vía Go Engine',
          summary: output,
          period: periodResult,
          rank_bonuses: rankBonuses,
        }));

      } catch (error) {
        console.error('❌ Error executing Go Engine:', error);
        return res.status(500).json({ 
          error: 'Error crítico en el motor de cierre Go', 
          details: error.message 
        });
      }

      /* Original JS logic preserved for reference
      const { tree, affiliations, activations } = req.body.data

      let users = []

      for (let node of tree) {
        if (node.rank != 'none') {
          users.push({
            name:           node.name,
            activated:      node.activated,
           _activated:      node._activated,
            points:         node.points,
            total:          node._total,
            rank:           node.rank,
            residual_bonus: node.residual_bonus,
          })
        }
      }
      console.log('1')

      await Closed.insert({
        id:   rand(),
        date: new Date(),
        users,
        tree,
        affiliations,
        activations,
      })
      console.log('2')

      for (let node of tree) {

        const { rank } = node

        if(rank != 'none') {

          await Transaction.insert({
            date:    new Date(),
            user_id: node.id,
            type:   'in',
            value:   node.residual_bonus,
            name:   'residual',
          })
          console.log('3')


          const pos = node.pays.findIndex(e => e.name == rank)

          if(pos != -1) {

            for(let i = 0; i <= pos; i++) {

              const pay = node.pays[i]

              if(!pay.payed) {

                const value = Pay[pay.name]

                await Transaction.insert({
                  date:    new Date(),
                  user_id: node.id,
                  type:   'in',
                  value:   value,
                  name:   'closed bonus',
                })
                console.log('4')

                pay.payed = true
              }
            }
          }

          if(rank == 'sapphire') node.bonuses['sapphire'].push(true)
          if(rank == 'ruby')     node.bonuses['ruby'].push(true)
          if(rank == 'gold')     node.bonuses['gold'].push(true)
          if(rank == 'diamond')  node.bonuses['diamond'].push(true)
        }

        if(!node.activated) node.n_inactives + 1
      }
      console.log('5')

      await User.updateMany({}, {
        activated: false,
       _activated: false,
        rank: 'none',
        points: 0,
        affiliation_points: 0,
      })
      console.log('6')

      for (let node of tree) {
        if(node.rank != 'none') {

          await User.updateOne(
            { id: node.id },
            {
              rank:               node.rank,
              pays:               node.pays,
              closeds:            node.closeds,
              bonuses:            node.bonuses,
              n_inactives:        node.n_inactives,
            },
          )
          console.log('7')
        }
      }
      console.log('8')

      await Affiliation.updateMany({}, { closed: true })
      await Activation.updateMany ({}, { closed: true })

      console.log('9')


      const virtualTransactions = await Transaction.find({ virtual: true })

      for(let transaction of virtualTransactions) {
        await Transaction.delete(
          { id: transaction.id }
        )
      }
      */
    }

    // response
    return res.json(success({}))
  }
}


export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
}
