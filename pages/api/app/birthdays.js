import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Tree } = db
const { error, success, midd } = lib

const MONTHS_SHORT = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

function getTodayInLima() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())

  const y = parseInt(parts.find((p) => p.type === "year").value, 10)
  const m = parseInt(parts.find((p) => p.type === "month").value, 10) - 1
  const d = parseInt(parts.find((p) => p.type === "day").value, 10)
  return new Date(y, m, d)
}

function parseBirthParts(birthdate) {
  if (!birthdate) return null

  if (typeof birthdate === "string") {
    const trimmed = birthdate.trim()

    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
      const month = parseInt(isoMatch[2], 10)
      const day = parseInt(isoMatch[3], 10)
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { month: month - 1, day }
      }
    }

    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10)
      const month = parseInt(dmyMatch[2], 10)
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { month: month - 1, day }
      }
    }
  }

  const bd = birthdate instanceof Date ? birthdate : new Date(birthdate)
  if (Number.isNaN(bd.getTime())) return null

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(bd)

  const month = parseInt(parts.find((p) => p.type === "month").value, 10) - 1
  const day = parseInt(parts.find((p) => p.type === "day").value, 10)
  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  return { month, day }
}

function getNextBirthdayInfo(birthdate, today) {
  const parts = parseBirthParts(birthdate)
  if (!parts) return null

  const { month, day } = parts
  const year = today.getFullYear()
  let next = new Date(year, month, day)
  next.setHours(0, 0, 0, 0)

  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)

  if (next < todayStart) {
    next = new Date(year + 1, month, day)
    next.setHours(0, 0, 0, 0)
  }

  const daysUntil = Math.round((next - todayStart) / (24 * 60 * 60 * 1000))
  const isToday = daysUntil === 0

  let proximityLabel = ""
  if (isToday) {
    proximityLabel = "¡Hoy!"
  } else if (daysUntil === 1) {
    proximityLabel = "Mañana 1 día"
  } else {
    proximityLabel = `En ${daysUntil} días`
  }

  const dayStr = String(day).padStart(2, "0")
  const dateBadge = `${dayStr} ${MONTHS_SHORT[month]}`
  const birthdayLabel = `${day} de ${MONTHS_LONG[month]}`

  return {
    daysUntil,
    isToday,
    proximityLabel,
    dateBadge,
    birthdayLabel,
    birthMonth: month + 1,
    birthDay: day,
    nextBirthday: next.toISOString(),
  }
}

function formatPlan(plan) {
  if (!plan || plan === "none") return "Ninguno"
  const v = String(plan).toLowerCase()
  if (v === "early") return "Cliente preferente"
  if (v === "basic") return "Ejecutivo"
  if (v === "standard") return "Distribuidor"
  if (v === "business") return "Empresarial"
  if (v === "master") return "Empresario"
  return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase()
}

function formatRank(rank) {
  if (!rank) return "Ninguno"
  const v = String(rank).toLowerCase()
  const map = {
    none: "Ninguno",
    active: "Activo",
    star: "Bronce",
    master: "Master",
    silver: "Plata",
    si: "Platino",
    gold: "Oro",
    sapphire: "Zafiro",
    rubi: "Ruby",
    ruby: "Ruby",
    rubí: "Ruby",
    bronce: "Bronce",
    plata: "Plata",
    oro: "Oro",
    esmeralda: "Esmeralda",
    diamante: "Diamante",
    "doble diamante": "Doble Diamante",
    "triple diamante": "Triple Diamante",
    "diamante estrella": "Diamante Estrella",
  }
  if (map[v]) return map[v]
  return rank.charAt(0).toUpperCase() + rank.slice(1).toLowerCase()
}

function formatDateDDMMYYYY(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function collectDescendantIds(tree, rootId, ids = new Set()) {
  const node = tree.find((e) => e.id == rootId)
  if (!node || !Array.isArray(node.childs) || node.childs.length === 0) return ids

  node.childs.forEach((childId) => {
    ids.add(String(childId))
    collectDescendantIds(tree, childId, ids)
  })
  return ids
}

function mapBirthdayUser(user, today) {
  const info = getNextBirthdayInfo(user.birthdate, today)
  if (!info) return null

  const fullName = [user.name, user.lastName].filter(Boolean).join(" ").trim()
  return {
    id: user.id,
    name: user.name,
    lastName: user.lastName,
    fullName,
    photo: user.photo || null,
    plan: user.plan,
    planLabel: formatPlan(user.plan),
    rank: user.rank,
    rankLabel: formatRank(user.rank),
    affiliation_date: user.affiliation_date || user.affiliationDate || null,
    affiliationDateFormatted: formatDateDDMMYYYY(user.affiliation_date || user.affiliationDate),
    birthdate: user.birthdate,
    activated: !!user.activated,
    affiliated: !!user.affiliated,
    dni: user.dni,
    email: user.email,
    phone: user.phone,
    country: user.country,
    points: Number(user.points) || 0,
    parentId: user.parentId || null,
    ...info,
  }
}

function mapMemberDetail(user, today, sponsor) {
  const base = mapBirthdayUser(user, today)
  if (!base) return null

  let birthdayProximityDetail = ""
  if (base.isToday) {
    birthdayProximityDetail = "¡Hoy es su cumpleaños!"
  } else if (base.daysUntil === 1) {
    birthdayProximityDetail = "¡Mañana es su cumpleaños!"
  } else {
    birthdayProximityDetail = `Faltan ${base.daysUntil} días para su cumpleaños`
  }

  return {
    ...base,
    birthdayProximityDetail,
    sponsor: sponsor
      ? {
          id: sponsor.id,
          name: sponsor.name,
          lastName: sponsor.lastName,
          fullName: [sponsor.name, sponsor.lastName].filter(Boolean).join(" ").trim(),
        }
      : null,
    statusLabel: user.activated ? "Activo" : user.affiliated ? "Afiliado" : "Inactivo",
    statusActive: !!user.activated,
  }
}

export default async (req, res) => {
  await midd(req, res)

  if (req.method !== "GET") {
    return res.json(error("method not allowed"))
  }

  let { session, memberId } = req.query

  session = await Session.findOne({ value: session })
  if (!session) return res.json(error("invalid session"))

  const user = await User.findOne({ id: session.id })
  if (!user) return res.json(error("user not found"))

  try {
    const tree = await Tree.find({})
    const descendantIds = collectDescendantIds(tree, user.id)

    if (descendantIds.size === 0) {
      return res.json(success({ birthdays: [], member: null, today: getTodayInLima().toISOString() }))
    }

    const networkUsers = await User.find({ id: { $in: [...descendantIds] } })
    const today = getTodayInLima()

    const birthdays = networkUsers
      .filter((u) => u.status !== "eliminated" && u.birthdate)
      .map((u) => mapBirthdayUser(u, today))
      .filter(Boolean)
      .sort((a, b) => {
        if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil
        return a.fullName.localeCompare(b.fullName, "es")
      })

    let member = null
    if (memberId) {
      const memberIdStr = String(memberId)
      if (!descendantIds.has(memberIdStr)) {
        return res.json(error("member not in network"))
      }

      const memberUser =
        networkUsers.find((u) => String(u.id) === memberIdStr) ||
        (await User.findOne({ id: memberIdStr }))

      if (!memberUser || memberUser.status === "eliminated") {
        return res.json(error("member not found"))
      }

      let sponsor = null
      if (memberUser.parentId) {
        sponsor = await User.findOne({ id: memberUser.parentId })
      }

      member = mapMemberDetail(memberUser, today, sponsor)
      if (!member) {
        const fullName = [memberUser.name, memberUser.lastName].filter(Boolean).join(" ").trim()
        member = {
          id: memberUser.id,
          name: memberUser.name,
          lastName: memberUser.lastName,
          fullName,
          photo: memberUser.photo || null,
          plan: memberUser.plan,
          planLabel: formatPlan(memberUser.plan),
          rank: memberUser.rank,
          rankLabel: formatRank(memberUser.rank),
          affiliation_date: memberUser.affiliation_date || memberUser.affiliationDate || null,
          affiliationDateFormatted: formatDateDDMMYYYY(memberUser.affiliation_date || memberUser.affiliationDate),
          activated: !!memberUser.activated,
          affiliated: !!memberUser.affiliated,
          dni: memberUser.dni,
          email: memberUser.email,
          phone: memberUser.phone,
          country: memberUser.country,
          points: Number(memberUser.points) || 0,
          birthdayLabel: null,
          birthdayProximityDetail: "Sin fecha de nacimiento registrada",
          statusLabel: memberUser.activated ? "Activo" : memberUser.affiliated ? "Afiliado" : "Inactivo",
          statusActive: !!memberUser.activated,
          sponsor: sponsor
            ? {
                id: sponsor.id,
                name: sponsor.name,
                lastName: sponsor.lastName,
                fullName: [sponsor.name, sponsor.lastName].filter(Boolean).join(" ").trim(),
              }
            : null,
        }
      }
    }

    return res.json(success({
      birthdays,
      member,
      today: today.toISOString(),
      networkCount: descendantIds.size,
    }))
  } catch (err) {
    console.error("Error fetching birthdays:", err)
    return res.json(error("Error fetching birthdays"))
  }
}
