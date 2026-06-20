import bcrypt from 'bcrypt'
import db     from "../../../components/db"
import lib    from "../../../components/lib"

const { User, Session, Token, Tree } = db
const { rand, error, success, midd } = lib


const Register = async (req, res) => {

  let { country, dni, name, lastName, date, email, password, phone, code, department, province, district, sponsorSession } = req.body

  // Validar que el código existe y no esté vacío
  if (!code || code.trim() === '') {
    return res.json(error('code required'))
  }

  code = code.trim().toUpperCase()

  const existingUser = await User.findOne({ dni })

  // Si el DNI ya existe y el usuario NO está eliminado → bloquear
  if (existingUser && existingUser.status !== 'eliminated') {
    return res.json(error('dni already use'))
  }

  // Validar que el email no esté en uso por OTRO usuario distinto
  if (email) {
    const existingEmail = await User.findOne({ email })
    if (existingEmail && (!existingUser || existingEmail.id !== existingUser.id)) {
      return res.json(error('email already use'))
    }
  }

  const parent = await User.findOne({ token: code })

  // valid code
  if(!parent) return res.json(error('code not found'))

  let isSponsorRegistration = false
  if (sponsorSession) {
    const sponsorSess = await Session.findOne({ value: String(sponsorSession).trim() })
    if (sponsorSess) {
      const sponsorUser = await User.findOne({ id: sponsorSess.id })
      if (sponsorUser && sponsorUser.status !== 'eliminated') {
        isSponsorRegistration = true
      }
    }
  }

  password = await bcrypt.hash(password, 12)

  // ── RE-REGISTRO: usuario eliminado que vuelve ──────────────────────────────
  if (existingUser && existingUser.status === 'eliminated') {
    const session = rand() + rand() + rand()

    // Generar nuevo token único
    let token = null
    let attempts = 0
    while (!token && attempts < 10) {
      const generatedToken = lib.generateToken()
      const existingToken = await User.findOne({ token: generatedToken })
      if (!existingToken) token = generatedToken
      attempts++
    }
    if (!token) return res.json(error('unable to generate unique token'))

    // Resetear el documento conservando el id (historial de auditoría intacto)
    await User.update({ id: existingUser.id }, {
      date: new Date(),
      country,
      name,
      lastName,
      birthdate: date,
      email,
      password,
      phone,
      department,
      province,
      district,
      parentId:     parent.id,
      affiliated:   false,
      _activated:   false,
      activated:    false,
      plan:         'default',
      points:       0,
      token,
      status:       'active',       // quitar estado eliminado
      eliminated_at: null,
      reregistered_at: new Date(),
    })

    // Cerrar sesiones viejas del usuario re-registrado (no del patrocinador)
    await Session.deleteMany({ id: existingUser.id })
    if (!isSponsorRegistration) {
      await Session.insert({ id: existingUser.id, value: session })
    }

    // Reparar nodo en el árbol: insertar bajo el nuevo patrocinador
    const _id = parent.coverage && parent.coverage.id ? parent.coverage.id : parent.id
    let parentNode = await Tree.findOne({ id: _id })
    if (parentNode && !parentNode.childs.includes(existingUser.id)) {
      parentNode.childs.push(existingUser.id)
      await Tree.update({ id: _id }, { childs: parentNode.childs })
    }
    // Actualizar o insertar el nodo propio del usuario
    const ownNode = await Tree.findOne({ id: existingUser.id })
    if (ownNode) {
      await Tree.update({ id: existingUser.id }, { parent: _id, childs: ownNode.childs || [] })
    } else {
      await Tree.insert({ id: existingUser.id, childs: [], parent: _id })
    }

    return res.json(success(
      isSponsorRegistration
        ? { sponsorRegistration: true, registeredDni: dni, affiliated: false, reregistered: true }
        : { session, affiliated: false, reregistered: true }
    ))
  }

  // ── REGISTRO NUEVO ─────────────────────────────────────────────────────────
  const id      = rand() + rand() + rand()
  const session = rand() + rand() + rand()

  // Generate a unique token dynamically (instead of using a pre-generated pool)
  let token = null
  let attempts = 0
  const maxAttempts = 10

  while (!token && attempts < maxAttempts) {
    const generatedToken = lib.generateToken()
    const existingToken = await User.findOne({ token: generatedToken })
    if (!existingToken) token = generatedToken
    attempts++
  }

  if (!token) return res.json(error('unable to generate unique token'))

  await User.insert({
    id,
    date: new Date(),
    country,
    dni,
    name,
    lastName,
    birthdate: date,
    email,
    password,
    phone,
    department,
    province,
    district,
    parentId:   parent.id,
    affiliated: false,
    _activated:  false,
    activated:  false,
    plan:      'default',
    photo:     '/avatar.png',
    points: 0,
    tree: true,
    token: token,
  })

  // save new session (omitir si el registro lo hace un patrocinador con sesión activa)
  if (!isSponsorRegistration) {
    await Session.insert({
      id: id,
      value: session,
    })
  }

  // insert to tree
  const _id = parent.coverage && parent.coverage.id ? parent.coverage.id : parent.id
  let node = await Tree.findOne({ id: _id })

  node.childs.push(id)

  await Tree.update({ id: _id }, { childs: node.childs })
  await Tree.insert({ id:  id, childs: [], parent: _id })

  // response
  return res.json(success(
    isSponsorRegistration
      ? { sponsorRegistration: true, registeredDni: dni, affiliated: false }
      : { session, affiliated: false }
  ))
}

export default async (req, res) => { await midd(req, res); return Register(req, res) }
