const cors = require('micro-cors')()

import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Transaction } = db
const { error, success } = lib
// const { error, success, model } = lib

// models
// const T = ['date', 'name', 'type', 'value']


const transactions = async (req, res) => {

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // get USER
  const user = await User.findOne({ id: session.id })
  console.log({ user })

  const users = await User.find({})

  // get TRANSACTIONS
  // let transactions = await Transaction.find({ userId: user.id, virtual: {$in: [null, false]} })
  let transactions = await Transaction.find({ user_id: user.id })
  console.log({ transactions })


  transactions = transactions.map(a => {

    if(a._user_id) {

      const u = users.find(e => e.id == a._user_id)

      return { ...a, user_name: u.name + ' ' + u.lastName }

    }

    return { ...a }
  })

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

    transactions,
  }))
}

module.exports = cors(transactions)
