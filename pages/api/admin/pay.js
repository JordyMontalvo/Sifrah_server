import db  from "../../../components/db"
import lib from "../../../components/lib"

const { Transaction, User } = db
const { error, success, midd, rand } = lib


export default async (req, res) => {
  await midd(req, res)

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

    const { dni, amount, desc } = req.body
    console.log({ dni, amount, desc })

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
    })

    return res.json(success())
  }
}
