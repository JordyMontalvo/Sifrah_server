import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Transaction } = db
const { error, success, midd } = lib


export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  const user = await User.findOne({ id: session.id })

  const users = await User.find({})


  if(req.method == 'GET') {

    // get collects
    let transactions = await Transaction.find({ user_id: user.id, name: 'wallet transfer' })

    transactions = transactions.map(a => {

      const u = users.find(e => e.id == a._user_id)

      return { ...a, name: u.name + ' ' + u.lastName }
    })


    // response
    return res.json(success({
      name:       user.name,
      lastName:   user.lastName,
      affiliated: user.affiliated,
      activated:  user.activated,
      plan:       user.plan,
      country:    user.country,
      photo:      user.photo,
      tree:       user.tree,

      transactions,
    }))
  }
}
