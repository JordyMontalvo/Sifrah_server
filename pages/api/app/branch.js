import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session } = db
const { error, success, midd } = lib


export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // check verified
  const user = await User.findOne({ id: session.userId })
  // if(!user.verified) return res.json(error('unverified user'))


  if(req.method == 'POST') {

    let { branch } = req.body

    console.log({ branch })

    await User.update({ id: user.id }, { branch })

    // response
    return res.json(success())
  }
}
