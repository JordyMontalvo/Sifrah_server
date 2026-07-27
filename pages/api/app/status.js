import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Tree, Closed } = db
const { error, success, midd } = lib

const ACTIVE_POINTS_THRESHOLD = 120

let tree
let users
let activateds

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
    lastClosed.data && Array.isArray(lastClosed.data.users)
      ? lastClosed.data.users
      : []
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

function resolveLastClosedRank(user, lastClosed) {
  if (!user || !lastClosed) return user?.rank || "none"
  const list = getClosedUsersList(lastClosed)
  const uid = String(user.id)
  const dni = user.dni != null ? String(user.dni).trim() : ""

  for (const entry of list) {
    const entryId = getUserIdFromClosedEntry(entry)
    if (entryId && String(entryId) === uid) {
      return normalizeRankFromClosedEntry(entry) || user.rank || "none"
    }
  }

  if (dni) {
    for (const entry of list) {
      const entryDni = entry?.dni != null ? String(entry.dni).trim() : ""
      if (entryDni && entryDni === dni) {
        return normalizeRankFromClosedEntry(entry) || user.rank || "none"
      }
    }
  }

  return user.rank || "none"
}

function isEliminated(u) {
  if (!u) return true
  const s = String(u.status || "")
    .toLowerCase()
    .trim()
  if (s === "eliminated" || s === "eliminado") return true
  if (u.eliminated_at) return true
  return false
}

function getUser(id) {
  if (id == null || id === "") return null
  return (
    users.get(id) ||
    users.get(String(id)) ||
    (Number.isFinite(Number(id)) ? users.get(Number(id)) : null) ||
    null
  )
}

function getTreeNode(id) {
  if (id == null || id === "") return null
  return tree[id] || tree[String(id)] || null
}

/**
 * Cuenta personas en la organización excluyendo eliminados.
 * Si un eliminado quedó en el árbol sin comprimir, no se suma,
 * pero sí se recorre su descendencia válida.
 */
function count(id) {
  const node = getTreeNode(id)
  if (!node) return 0

  const u = getUser(id)
  const selfEliminated = isEliminated(u)

  if (u && !selfEliminated && u.activated) activateds++

  let ret = 0
  for (const childId of node.childs || []) {
    if (childId == null || childId === "") continue
    const child = getUser(childId)
    const childEliminated = isEliminated(child)
    const sub = count(childId)
    if (childEliminated) {
      // No contar al eliminado; conservar solo descendientes válidos
      ret += sub
    } else {
      ret += sub + 1
    }
  }
  return ret
}

export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  session = await Session.findOne({ value: session })
  if (!session) return res.json(error("invalid session"))

  const userId = session.id || session.userId
  const user = await User.findOne({ id: userId })
  if (!user) return res.json(error("user not found"))

  tree = await Tree.find({})
  activateds = 0

  const ids = tree.map((e) => e.id)
  const usersList = await User.find({ id: { $in: ids } })
  users = new Map()
  for (const u of usersList) {
    if (!u || u.id == null) continue
    users.set(u.id, u)
    users.set(String(u.id), u)
    const n = Number(u.id)
    if (!Number.isNaN(n)) users.set(n, u)
  }

  tree = tree.reduce((a, b) => {
    a[`${b.id}`] = b
    if (b.id != null) a[b.id] = b
    return a
  }, {})

  // Equipo = personas en la organización (activos, inactivos y registrados), sin eliminados
  const team = count(user.id)
  if (user.activated && !isEliminated(user)) activateds--

  // Frontales = patrocinados directamente, cualquier estado excepto eliminados
  const directSponsored = (await User.find({ parentId: user.id })).filter(
    (u) => u && !isEliminated(u)
  )
  const frontals_total = directSponsored.length
  // Frontales activos del período: 120+ puntos personales
  const frontals_active = directSponsored.filter(
    (u) => (Number(u.points) || 0) >= ACTIVE_POINTS_THRESHOLD
  ).length

  const points = Number(user.points) || 0
  const period_active = points >= ACTIVE_POINTS_THRESHOLD

  let lastClosed = null
  try {
    lastClosed = await fetchLastClosed()
  } catch (e) {
    lastClosed = null
  }
  const rank = resolveLastClosedRank(user, lastClosed)

  return res.json(
    success({
      name: user.name,
      lastName: user.lastName,
      affiliated: user.affiliated,
      activated: user.activated,
      _activated: user._activated,
      period_active,
      date: user.date,
      affiliationDate: user.affiliationDate || user.affiliation_date || null,
      plan: user.plan,
      country: user.country,
      photo: user.photo,
      token: user.token,

      rank,
      points,
      total_points: user.total_points || 0,
      team,
      frontals_total,
      frontals_active,
      activateds,
      unactivateds: Math.max(0, team - activateds),
    })
  )
}
