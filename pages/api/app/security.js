import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session } = db
const { error, success, midd } = lib

function normalizeBeneficiary(raw) {
  if (!raw || typeof raw !== "object") return null
  const name = String(raw.name || "").trim()
  const lastName = String(raw.lastName || "").trim()
  const fullName = String(raw.fullName || "").trim() || [name, lastName].filter(Boolean).join(" ")
  const dni = String(raw.dni || "").trim()
  const relation = String(raw.relation || "").trim()
  const phone = String(raw.phone || "").trim()
  const email = String(raw.email || "").trim()
  if (!fullName || !dni || !relation || !phone) return null
  return {
    name: name || fullName.split(/\s+/)[0] || "",
    lastName: lastName || fullName.split(/\s+/).slice(1).join(" ") || "",
    fullName,
    dni,
    relation,
    phone,
    email,
    registeredAt: raw.registeredAt || null,
  }
}

/** Migra el formato antiguo (1 persona plana) al nuevo (primary/secondary). */
function normalizeSecurity(raw) {
  if (!raw || typeof raw !== "object") {
    return { primary: null, secondary: null, termsAcceptedAt: null }
  }

  if (raw.primary || raw.secondary) {
    return {
      primary: normalizeBeneficiary(raw.primary),
      secondary: normalizeBeneficiary(raw.secondary),
      termsAcceptedAt: raw.termsAcceptedAt || null,
    }
  }

  // Formato legado: { name, lastName, dni, relation, phone }
  const primary = normalizeBeneficiary(raw)
  return {
    primary,
    secondary: null,
    termsAcceptedAt: primary ? raw.termsAcceptedAt || null : null,
  }
}

export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  session = await Session.findOne({ value: session })
  if (!session) return res.json(error("invalid session"))

  const user = await User.findOne({ id: session.id })
  if (!user) return res.json(error("invalid session"))

  if (req.method == "GET") {
    const security = normalizeSecurity(user.security)
    return res.json(
      success({
        name: user.name,
        lastName: user.lastName,
        affiliated: user.affiliated,
        activated: user.activated,
        photo: user.photo || null,
        rank: user.rank || "none",
        security,
        // Compat: algunos clientes antiguos esperan el objeto plano
        legacySecurity: security.primary
          ? {
              name: security.primary.name,
              lastName: security.primary.lastName,
              dni: security.primary.dni,
              relation: security.primary.relation,
              phone: security.primary.phone,
            }
          : null,
      })
    )
  }

  if (req.method == "POST") {
    const existing = normalizeSecurity(user.security)

    // Una vez registrado el principal, solo se permiten cambios vía soporte
    if (existing.primary) {
      return res.json(
        error("Los beneficiarios ya están registrados. Solicita un cambio con soporte.")
      )
    }

    const { primary, secondary, termsAccepted } = req.body || {}

    if (!termsAccepted) {
      return res.json(error("Debes aceptar los Términos y Condiciones del Legado SIFRAH."))
    }

    const primaryNorm = normalizeBeneficiary(primary)
    if (!primaryNorm) {
      return res.json(
        error("Completa los datos del beneficiario principal (nombre, documento, parentesco y teléfono).")
      )
    }

    const secondaryNorm = secondary ? normalizeBeneficiary(secondary) : null
    if (secondary && !secondaryNorm) {
      return res.json(
        error("Si agregas beneficiario secundario, completa nombre, documento, parentesco y teléfono.")
      )
    }

    const now = new Date().toISOString()
    primaryNorm.registeredAt = now
    if (secondaryNorm) secondaryNorm.registeredAt = now

    const security = {
      primary: primaryNorm,
      secondary: secondaryNorm,
      termsAcceptedAt: now,
      // Compat con lecturas antiguas
      name: primaryNorm.name,
      lastName: primaryNorm.lastName,
      dni: primaryNorm.dni,
      relation: primaryNorm.relation,
      phone: primaryNorm.phone,
    }

    await User.update({ id: user.id }, { security })

    return res.json(success({ security: normalizeSecurity(security) }))
  }

  return res.json(error("method not allowed"))
}
