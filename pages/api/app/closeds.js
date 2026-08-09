import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Closed, Transaction, Period } = db
const { error, success, midd } = lib

const AFF_NAMES = new Set(["affiliation bonus", "migration bonus"])
const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

function findUserEntry(closed, userId) {
  const list = closed.users || closed.tree || []
  const uid = String(userId)
  return (
    list.find((u) => {
      const id = u.user_id != null ? u.user_id : u.userId != null ? u.userId : u.id
      return id != null && String(id) === uid
    }) || null
  )
}

function periodMeta(closed) {
  if (closed.period_key) {
    return {
      period_key: closed.period_key,
      period_label:
        closed.period_label || labelFromKey(closed.period_key) || "Periodo",
    }
  }
  const d = closed.date ? new Date(closed.date) : null
  if (d && !Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const key = `${y}-${String(m).padStart(2, "0")}`
    return {
      period_key: key,
      period_label: closed.period_label || `${MONTHS_ES[m - 1]} ${y}`,
    }
  }
  return {
    period_key: closed.id || String(closed.date || "unknown"),
    period_label: closed.period_label || "Periodo",
  }
}

function labelFromKey(key) {
  const m = String(key || "").match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return `${MONTHS_ES[month - 1]} ${m[1]}`
}

function periodDateRange(periodKey, closedAt) {
  const m = String(periodKey || "").match(/^(\d{4})-(\d{2})$/)
  if (!m) {
    return {
      start: null,
      end: closedAt || null,
    }
  }
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const start = new Date(y, mo, 1, 0, 0, 0, 0)
  let end = closedAt ? new Date(closedAt) : new Date(y, mo + 1, 0, 23, 59, 59, 999)
  if (Number.isNaN(end.getTime())) {
    end = new Date(y, mo + 1, 0, 23, 59, 59, 999)
  }
  return { start, end }
}

function countOrgActive(snapshot) {
  if (!snapshot) return { activePeople: 0, activeLevels: 0, activeFrontals: 0 }

  let activePeople = 0
  let activeFrontals = 0
  let maxDepth = 0

  const isActiveNode = (n) => {
    if (!n) return false
    const rank = String(n.rank || "").toLowerCase()
    if (rank && rank !== "none") return true
    if (n.activated || n._activated) return true
    const pts = Number(n.personal_points || n.points || n._total || 0)
    return pts > 0
  }

  const walk = (node, depth) => {
    if (!node) return
    const kids = node.childs || node.children || []
    for (const ch of kids) {
      if (isActiveNode(ch)) {
        activePeople++
        if (depth === 1) activeFrontals++
        if (depth > maxDepth) maxDepth = depth
      }
      walk(ch, depth + 1)
    }
  }

  walk(snapshot, 1)
  return {
    activePeople,
    activeLevels: maxDepth,
    activeFrontals,
  }
}

function sumAmounts(rows, key = "amount") {
  return (rows || []).reduce((s, r) => s + (Number(r[key]) || 0), 0)
}

function mapResidualLines(entry) {
  const lines = entry.residual_lines || entry.residual_bonus_arr || []
  return lines.map((ln, i) => {
    const level =
      ln.level != null
        ? Number(ln.level)
        : ln.n != null
          ? Number(ln.n) + 1
          : null
    const pct =
      ln.percentage != null
        ? Number(ln.percentage)
        : ln.r != null
          ? Number(ln.r) * (ln.rr != null ? Number(ln.rr) : 1)
          : null
    const amount =
      ln.amount != null
        ? Number(ln.amount)
        : ln.val != null && pct != null
          ? Number(ln.val) * pct
          : Number(ln.val) || 0
    return {
      id: `res-${i}`,
      level: level || 0,
      name: ln.name || "—",
      dni: ln.dni || null,
      pr: ln.pr != null ? Number(ln.pr) : ln.val != null ? Number(ln.val) : null,
      percentage: pct,
      amount,
      date: ln.date || null,
    }
  })
}

function mapGenerationalLines(entry) {
  const lines = entry.generational_lines || []
  return lines.map((ln, i) => ({
    id: `gen-${i}`,
    level: ln.generation != null ? Number(ln.generation) : Number(ln.level) || 0,
    name: ln.name || "—",
    dni: ln.dni || null,
    pr: ln.pr != null ? Number(ln.pr) : null,
    percentage: ln.percentage != null ? Number(ln.percentage) : null,
    amount: Number(ln.amount) || 0,
  }))
}

function mapAffiliationTxs(txs) {
  return (txs || []).map((tx, i) => ({
    id: tx.id || `aff-${i}`,
    date: tx.date || null,
    name: tx.affiliate_name || tx._user_name || tx.desc || "Afiliación",
    dni: tx.affiliate_dni || tx._user_dni || null,
    package: tx.plan_name || tx.package || null,
    points: tx.points != null ? Number(tx.points) : null,
    amount: Number(tx.value) || 0,
    level: tx.level != null ? Number(tx.level) : tx.i != null ? Number(tx.i) + 1 : null,
    percentage: tx.percentage != null ? Number(tx.percentage) : null,
    virtual: !!tx.virtual,
  }))
}

export default async (req, res) => {
  await midd(req, res)

  let { session, period_key: periodKey } = req.query

  session = await Session.findOne({ value: session })
  if (!session) return res.json(error("invalid session"))

  const user = await User.findOne({ id: session.id })
  if (!user) return res.json(error("user not found"))

  if (req.method !== "GET") return res.json(error("method not allowed"))

  try {
    let closeds = await Closed.find({})
    closeds = (closeds || []).slice().sort((a, b) => {
      return new Date(b.date || 0) - new Date(a.date || 0)
    })

    // Solo periodos donde el socio aparece en el snapshot
    const userCloseds = []
    for (const c of closeds) {
      const entry = findUserEntry(c, user.id)
      if (!entry) continue
      const meta = periodMeta(c)
      userCloseds.push({ closed: c, entry, ...meta })
    }

    const periods = userCloseds.map(({ closed, period_key, period_label }) => ({
      closed_id: closed.id,
      period_key,
      period_label,
      date: closed.date,
    }))

    if (!userCloseds.length) {
      return res.json(
        success({
          name: user.name,
          lastName: user.lastName,
          dni: user.dni || null,
          token: user.token || null,
          photo: user.photo || null,
          id: user.id,
          periods: [],
          report: null,
        })
      )
    }

    let selected =
      periodKey &&
      userCloseds.find((x) => String(x.period_key) === String(periodKey))
    if (!selected) selected = userCloseds[0]

    const { closed, entry, period_key, period_label } = selected

    // Periodo BD (fechas exactas de cierre)
    let periodDoc = null
    try {
      periodDoc = await Period.findOne({ key: period_key })
    } catch (_) {
      periodDoc = null
    }
    const closedAt =
      (periodDoc && periodDoc.closedAt) || closed.date || null
    const range = periodDateRange(period_key, closedAt)

    // Transacciones del socio (afiliación del periodo + total previo)
    let allUserTx = []
    try {
      allUserTx = (await Transaction.find({ user_id: user.id })) || []
    } catch (e) {
      console.error("[app/closeds] tx", e)
      allUserTx = []
    }

    const isAffTx = (tx) => {
      if (!tx || tx.type === "out") return false
      const name = String(tx.name || "").toLowerCase()
      return AFF_NAMES.has(name)
    }

    let affTxs = allUserTx.filter((tx) => {
      if (!isAffTx(tx)) return false
      if (tx.period_key && period_key) {
        return String(tx.period_key) === String(period_key)
      }
      if (!tx.date || !range.start) return false
      const d = new Date(tx.date)
      return d >= range.start && d <= (range.end || d)
    })

    const residualLines = mapResidualLines(entry)
    residualLines.sort((a, b) => (a.level || 0) - (b.level || 0))

    const genLines = mapGenerationalLines(entry)
    genLines.sort((a, b) => (a.level || 0) - (b.level || 0))

    const affiliation = {
      total: sumAmounts(affTxs, "value") || mapAffiliationTxs(affTxs).reduce((s, r) => s + r.amount, 0),
      rows: mapAffiliationTxs(affTxs),
    }
    // recompute total cleanly
    affiliation.total = affiliation.rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)

    const residualFromLines = residualLines.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const residual = {
      total: Number(entry.residual_bonus) || residualFromLines || 0,
      rows: residualLines,
    }

    // Bono rango = mantenimiento (liderazgo); recalificación = logro
    const data = closed.data || {}
    const uid = String(user.id)
    const logroRows = (data.rank_bonus_logro || [])
      .filter((r) => String(r.user_id || r.userId) === uid)
      .map((r, i) => ({
        id: `logro-${i}`,
        tipo: "logro",
        rank: r.rank || entry.rank,
        amount: Number(r.amount) || 0,
        label: r.label || "Bono inicio de rango / recalificación",
      }))
    const mantRows = (data.rank_bonus_mantenimiento || [])
      .filter((r) => String(r.user_id || r.userId) === uid)
      .map((r, i) => ({
        id: `mant-${i}`,
        tipo: "mantenimiento",
        rank: r.rank || entry.rank,
        amount: Number(r.amount) || 0,
        label: r.label || "Bono liderazgo / rango",
      }))

    const rankLead = {
      total: mantRows.reduce((s, r) => s + r.amount, 0),
      rows: mantRows,
    }
    const rankStart = {
      total: logroRows.reduce((s, r) => s + r.amount, 0),
      rows: logroRows,
    }

    const savings = {
      total: Number(entry.savings_bonus) || 0,
      rows:
        Number(entry.savings_bonus) > 0
          ? [
              {
                id: "sav-0",
                label: "Bono Ahorro Sifrah",
                amount: Number(entry.savings_bonus) || 0,
              },
            ]
          : [],
    }

    // Generacional VIP se agrupa como apoyo de residuales o se muestra? Design shows:
    // Afiliaciones, Residuales, Bono Liderazgo, Bono Inicio, Bono Ahorro
    // Include generational inside residual total+list as "Residuales +" for honesty
    const genTotal = Number(entry.generational_bonus) || 0
    if (genTotal > 0 || genLines.length) {
      residual.total = Number(residual.total || 0) + genTotal
      residual.rows = residual.rows.concat(
        genLines.map((g) => ({
          ...g,
          id: `gen-merged-${g.id}`,
          name: g.name + " (Gen. VIP)",
        }))
      )
      residual.rows.sort((a, b) => (a.level || 0) - (b.level || 0))
    }

    const total =
      Number(affiliation.total || 0) +
      Number(residual.total || 0) +
      Number(rankLead.total || 0) +
      Number(rankStart.total || 0) +
      Number(savings.total || 0)

    const pct = (n) => (total > 0 ? Math.round((Number(n || 0) / total) * 1000) / 10 : 0)

    const breakdown = [
      {
        key: "affiliations",
        label: "Afiliaciones",
        amount: affiliation.total,
        percent: pct(affiliation.total),
        color: "#e91e63",
      },
      {
        key: "residual",
        label: "Residuales",
        amount: residual.total,
        percent: pct(residual.total),
        color: "#22c55e",
      },
      {
        key: "rank_lead",
        label: "Bono Liderazgo (Rango)",
        amount: rankLead.total,
        percent: pct(rankLead.total),
        color: "#7c3aed",
      },
      {
        key: "rank_start",
        label: "Bono Inicio de Rango",
        amount: rankStart.total,
        percent: pct(rankStart.total),
        color: "#eab308",
      },
      {
        key: "savings",
        label: "Bono Ahorro",
        amount: savings.total,
        percent: pct(savings.total),
        color: "#3b82f6",
      },
    ]

    // Periodo anterior para comparar
    const idx = userCloseds.findIndex((x) => x.period_key === period_key)
    let prevTotal = null
    if (idx >= 0 && idx + 1 < userCloseds.length) {
      const prev = userCloseds[idx + 1]
      const pe = prev.entry
      let pAff = 0
      pAff = allUserTx
        .filter((tx) => {
          if (!isAffTx(tx)) return false
          return prev.period_key && tx.period_key === prev.period_key
        })
        .reduce((s, t) => s + (Number(t.value) || 0), 0)
      const pRes =
        (Number(pe.residual_bonus) || 0) + (Number(pe.generational_bonus) || 0)
      const pSav = Number(pe.savings_bonus) || 0
      const pData = prev.closed.data || {}
      const pUid = String(user.id)
      const pLogro = (pData.rank_bonus_logro || [])
        .filter((r) => String(r.user_id || r.userId) === pUid)
        .reduce((s, r) => s + (Number(r.amount) || 0), 0)
      const pMant = (pData.rank_bonus_mantenimiento || [])
        .filter((r) => String(r.user_id || r.userId) === pUid)
        .reduce((s, r) => s + (Number(r.amount) || 0), 0)
      prevTotal = pAff + pRes + pSav + pLogro + pMant
    }

    let growthPercent = null
    if (prevTotal != null && prevTotal > 0) {
      growthPercent = Math.round(((total - prevTotal) / prevTotal) * 1000) / 10
    } else if (prevTotal === 0 && total > 0) {
      growthPercent = 100
    }

    const org = countOrgActive(entry.tree_snapshot)

    const personalPts = Number(
      entry.personal_points != null
        ? entry.personal_points
        : (Number(entry.points) || 0) + (Number(entry.affiliation_points) || 0)
    )
    const reconsumoPts = Number(
      entry.reconsumo_points != null ? entry.reconsumo_points : entry.points || 0
    )
    const affPts = Number(entry.affiliation_points || 0)
    const groupPts = Number(
      entry.total_points != null
        ? entry.total_points
        : entry._total != null
          ? entry._total
          : entry.total || 0
    )

    const report = {
      period_key,
      period_label,
      closed_id: closed.id,
      closed_at: closedAt,
      period_start: range.start,
      period_end: range.end,
      rank: entry.rank || null,
      payment_status: "En saldo",
      payment_status_label: "En saldo",
      org: {
        active_people: org.activePeople,
        active_levels: org.activeLevels,
        active_frontals: org.activeFrontals,
      },
      totals: {
        total,
        prev_total: prevTotal,
        growth_percent: growthPercent,
      },
      breakdown,
      volume: {
        total_points: groupPts,
        affiliation_points: affPts,
        reconsumo_points: reconsumoPts,
        personal_points: personalPts,
        affiliation_share:
          groupPts > 0 ? Math.round((affPts / groupPts) * 1000) / 10 : 0,
        reconsumo_share:
          groupPts > 0
            ? Math.round((reconsumoPts / groupPts) * 1000) / 10
            : 0,
      },
      details: {
        affiliations: affiliation,
        residual,
        rank_lead: rankLead,
        rank_start: rankStart,
        savings,
      },
    }

    return res.json(
      success({
        name: user.name,
        lastName: user.lastName,
        dni: user.dni || null,
        token: user.token || null,
        photo: user.photo || null,
        id: user.id,
        periods,
        report,
      })
    )
  } catch (e) {
    console.error("[app/closeds]", e)
    return res.status(500).json(error("could not load month closing"))
  }
}
