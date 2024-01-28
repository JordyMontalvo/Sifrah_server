import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Closed } = db
const { error, success, midd } = lib


export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // check verified
  const user = await User.findOne({ id: session.id })
  // if(!user.verified) return res.json(error('unverified user'))

  const closeds = await Closed.find({})

  if(req.method == 'GET') {

    // response
    return res.json(success({
      name:       user.name,
      lastName:   user.lastName,
      affiliated: user.affiliated,
      activated:  user.activated,

      id: user.id,
      closeds,
    }))
  }
}
