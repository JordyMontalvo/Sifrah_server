import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session } = db
const { error, success, midd } = lib

const PROFILE_API = "persist-v1"

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, private, must-revalidate")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Expires", "0")
}

function textOrNull(value) {
  if (value == null || value === "null" || value === "undefined") return null
  const s = String(value).trim()
  return s ? s : null
}

function serializeProfile(user, token) {
  const account_holder = textOrNull(user.account_holder) || textOrNull(user.titular)
  return {
    profileApi: PROFILE_API,
    affiliated: user.affiliated,
    _activated: user._activated,
    activated: user.activated,
    plan: user.plan,
    photo: user.photo,
    tree: user.tree,
    country: user.country || null,
    dni: user.dni,
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    birthdate: user.birthdate,
    address: user.address,
    token: token != null ? token : user.token,
    city: user.city,
    bank: textOrNull(user.bank),
    account_type: textOrNull(user.account_type),
    account: textOrNull(user.account),
    ibk: textOrNull(user.ibk),
    account_holder,
    titular: account_holder,
    yape: textOrNull(user.yape),
    plin: textOrNull(user.plin),
  }
}


export default async (req, res) => {
  await midd(req, res)
  noStore(res)

  let { session } = req.query

  session = await Session.findOne({ value: session })
  if (!session) return res.json({ error: true, msg: "invalid session", profileApi: PROFILE_API })

  const user = await User.findOne({ id: session.id })
  if (!user) return res.json({ error: true, msg: "invalid session", profileApi: PROFILE_API })


  if (req.method == "GET") {

    let token = user.token
    if (!token || token === null) {
      let attempts = 0
      const maxAttempts = 10

      while (!token && attempts < maxAttempts) {
        const generatedToken = lib.generateToken()
        const existingToken = await User.findOne({ token: generatedToken })
        if (!existingToken) {
          token = generatedToken
        }
        attempts++
      }

      if (token) {
        await User.update({ id: user.id }, { token })
      }
    }

    return res.json(success(serializeProfile(user, token)))
  }

  if (req.method == "POST") {

    // Mismo patrón que /app/photo, que sí persiste en producción
    const body = req.body || {}
    const email = body.email
      ? String(body.email).toLowerCase().replace(/ /g, "")
      : (user.email || "")
    const name = textOrNull(body.name) || user.name
    const lastName = body.lastName != null ? (textOrNull(body.lastName) || "") : user.lastName
    const holder = textOrNull(body.account_holder) || textOrNull(body.titular) || textOrNull(user.account_holder) || textOrNull(user.titular)

    await User.update({ id: user.id }, {
      name,
      lastName,
      email,
      phone: body.phone != null ? textOrNull(body.phone) : user.phone,
      address: body.address != null ? textOrNull(body.address) : user.address,
      bank: body.bank != null ? textOrNull(body.bank) : user.bank,
      account_type: body.account_type != null ? textOrNull(body.account_type) : user.account_type,
      account: body.account != null ? textOrNull(body.account) : user.account,
      ibk: body.ibk != null ? textOrNull(body.ibk) : user.ibk,
      account_holder: holder,
      titular: holder,
      yape: body.yape != null ? textOrNull(body.yape) : user.yape,
      plin: body.plin != null ? textOrNull(body.plin) : user.plin,
      city: body.city != null ? textOrNull(body.city) : user.city,
      country: body.country != null ? textOrNull(body.country) : user.country,
      birthdate: body.birthdate != null ? textOrNull(body.birthdate) : user.birthdate,
    })

    const updated = await User.findOne({ id: user.id })
    return res.json(success(serializeProfile(updated || user)))
  }
}
