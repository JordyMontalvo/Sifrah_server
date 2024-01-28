import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Promo } = db
const { error, success, midd, map, rand } = lib


export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // get USER
  const user = await User.findOne({ id: session.id })
  // if(!user.verified) return res.json(error('unverified user'))


  if(req.method == 'POST') {
    console.log('POST ...')
    let { voucher, type } = req.body

    // save new promo
    await Promo.insert({
      date:   new Date(),
      id:     rand(),
      userId: user.id,
      voucher,
      type,
      status: 'pending',
    })

    // response
    return res.json(success())
  }
}
