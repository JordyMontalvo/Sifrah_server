import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session } = db
const { error, success, midd } = lib


const Verify = async (req, res) => {

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  const id = session.userId

  // check verified
  const user = await User.findOne({ id })
  if(user.verified) return res.json(error('verified user'))

  // response
  return res.json(success({ email: user.email }))
}

export default async (req, res) => { await midd(req, res); return Verify(req, res) }
