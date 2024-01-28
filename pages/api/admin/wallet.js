import db from "../../../components/db"
import lib from "../../../components/lib"

const { Transaction, User } = db
const { midd, success } = lib


export default async (req, res) => {
  await midd(req, res)

  const users = await User.find({})


  // get collects
  let transactions = await Transaction.find({ name: 'wallet transfer', type: 'out' })

  transactions = transactions.map(a => {

    const  u = users.find(e => e.id == a.user_id)
    const _u = users.find(e => e.id == a._user_id)

    return { ...a, name: u.name + u.lastName, _name: _u.name + _u.lastName}
  })


  // response
  return res.json(success({
    transactions
  }))
}
