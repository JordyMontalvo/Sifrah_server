import bcrypt from 'bcrypt'
import db     from "../../../components/db"
import lib    from "../../../components/lib"

const { User, Session, Token, Tree } = db
const { rand, error, success, midd } = lib


const Register = async (req, res) => {

  let { country, dni, name, lastName, date, email, password, phone, code } = req.body

  code = code.trim().toUpperCase()

  const user = await User.findOne({ dni })

  // valid dni
  if(user) return res.json(error('dni already use'))
  
  const parent = await User.findOne({ token: code })

  // valid code
  if(!parent) return res.json(error('code not found'))

  
  password = await bcrypt.hash(password, 12)

  const      id  = rand()
  const session  = rand() + rand() + rand()


  // reserve Token
  const token = await Token.findOne({ free: true })
  if(!token) return res.json(error('token not available'))
  await Token.update({ value: token.value }, { free: false })


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
    parentId:   parent.id,
    affiliated: false,
    activated:  false,
    plan:      'default',
    photo:     'https://ik.imagekit.io/asu/impulse/avatar_cWVgh_GNP.png',
    points: 0,
    // tree: false,
    tree: true,
    coverage: { id },
    token: token.value,
  })
  
  // save new session
  await Session.insert({
    id: id,
    value: session,
  })


  // insert to tree
  // const parent = await User.findOne({ id: user.parentId })
  const coverage = parent.coverage

  let _id  = coverage.id
  let node = await Tree.findOne({ id: _id })

  node.childs.push(id)

  await Tree.update({ id: _id }, { childs: node.childs })
  await Tree.insert({ id:  id, childs: [], parent: _id })


  // response
  return res.json(success({ session }))
}

export default async (req, res) => { await midd(req, res); return Register(req, res) }
