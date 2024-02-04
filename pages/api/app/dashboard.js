import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Transaction, Tree, Banner } = db
const { error, success, acum, midd } = lib


export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  // valid session
      session = await Session.findOne({ value: session })
  if(!session)  return res.json(error('invalid session'))

  // get USER
  const user = await User.findOne({ id: session.id })

  // get transactions
  const transactions        = await Transaction.find({ user_id: user.id, virtual: {$in: [null, false]} })
  const virtualTransactions = await Transaction.find({ user_id: user.id, virtual:              true    })

  const ins         = acum(transactions,        {type: 'in' }, 'value')
  const outs        = acum(transactions,        {type: 'out'}, 'value')
  const insVirtual  = acum(virtualTransactions, {type: 'in' }, 'value')
  const outsVirtual = acum(virtualTransactions, {type: 'out'}, 'value')


  const banner = await Banner.findOne({})

  // response
  return res.json(success({
    name:       user.name,
    lastName:   user.lastName,
    affiliated: user.affiliated,
    _activated: user._activated,
    activated:  user.activated,
    plan:       user.plan,
    country:    user.country,
    photo:      user.photo,
    tree:       user.tree,

    banner,
    ins,
    insVirtual,
    outs,
    balance: (ins - outs),
   _balance: (insVirtual - outsVirtual),
    rank:    user.rank,
    points:  user.points,
  }))
}
