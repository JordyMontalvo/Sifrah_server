import db  from "../../../components/db"
import lib from "../../../components/lib"
import { requireAdmin } from "../../../components/adminAuth";

const { Transaction, User, Period } = db
const { error, success, midd, rand } = lib


export default async (req, res) => {
  await midd(req, res)
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if(req.method == 'GET') {
    const users = await User.find({})

    let pays = await Transaction.find({ name: 'pay' })

    for (let p of pays) {
      const user = users.find(e => e.id == p.user_id)
      p.user = user
    }

    return res.json(success({
      pays,
    }))
  }

  if(req.method == 'POST') {

    const { dni, amount, desc, period_key } = req.body
    console.log({ dni, amount, desc, period_key })

    if (!period_key) {
      return res.json(error('period_key is required'))
    }

    const period = await Period.findOne({ key: period_key })
    if (!period) {
      return res.json(error('period not found'))
    }

    const user = await User.findOne({ dni })

    if(!user) return res.json(error('dni not found'))

    await Transaction.insert({
      id:      rand(),
      date:    new Date(),
      user_id: user.id,
      type:   'in',
      value:   parseFloat(amount),
      desc,
      virtual: false,
      name: 'pay',
      period_key: period.key,
      period_label: period.label || period.key,
    })

    return res.json(success())
  }
}
