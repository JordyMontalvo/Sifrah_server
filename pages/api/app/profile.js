import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session } = db
const { error, success, midd } = lib

function textOrNull(value) {
  if (value == null || value === "null" || value === "undefined") return null
  const s = String(value).trim()
  return s ? s : null
}

function serializeProfile(user, token) {
  const account_holder = textOrNull(user.account_holder) || textOrNull(user.titular)
  return {
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

function pickText(body, key, fallback) {
  return Object.prototype.hasOwnProperty.call(body, key) ? textOrNull(body[key]) : fallback
}


export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if (!session) return res.json(error('invalid session'))

  // get user
  const user = await User.findOne({ id: session.id })
  if (!user) return res.json(error('invalid session'))


  if (req.method == 'GET') {

    // Si el usuario no tiene token, generar uno automáticamente
    let token = user.token
    if (!token || token === null) {
      // Generar un token único
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
      
      // Actualizar el usuario con el nuevo token
      if (token) {
        await User.update({ id: user.id }, { token })
      }
    }

    // response
    return res.json(success(serializeProfile(user, token)))
  }

  if (req.method == 'POST') {

    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {}

      const email = body.email
        ? String(body.email).toLowerCase().replace(/ /g, '')
        : (user.email || '')
      const name = textOrNull(body.name) || user.name
      const lastName = body.lastName != null
        ? (textOrNull(body.lastName) || '')
        : user.lastName

      const account_holder = Object.prototype.hasOwnProperty.call(body, 'account_holder') || Object.prototype.hasOwnProperty.call(body, 'titular')
        ? (textOrNull(body.account_holder) || textOrNull(body.titular))
        : (textOrNull(user.account_holder) || textOrNull(user.titular))

      const payload = {
        name,
        lastName,
        email,
        phone: pickText(body, 'phone', user.phone),
        address: pickText(body, 'address', user.address),
        bank: pickText(body, 'bank', user.bank),
        account_type: pickText(body, 'account_type', user.account_type),
        account: pickText(body, 'account', user.account),
        ibk: pickText(body, 'ibk', user.ibk),
        account_holder,
        titular: account_holder,
        yape: pickText(body, 'yape', user.yape),
        plin: pickText(body, 'plin', user.plin),
        city: pickText(body, 'city', user.city),
        country: pickText(body, 'country', user.country),
        birthdate: pickText(body, 'birthdate', user.birthdate),
      }

      // Mongo 3.x no acepta undefined dentro de $set
      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) delete payload[key]
      })

      await User.update({ id: user.id }, payload)

      const updated = await User.findOne({ id: user.id })
      return res.json(success(serializeProfile(updated || { ...user, ...payload })))
    } catch (e) {
      console.error('profile update error', e)
      return res.json(error('No se pudo guardar el perfil'))
    }
  }
}
