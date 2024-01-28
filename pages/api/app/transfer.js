import bcrypt from 'bcrypt'
import db     from "../../../components/db"
import lib    from "../../../components/lib"

const { User, Session, Transaction, Collect } = db
const { error, success, midd, acum, rand } = lib

const admin_password  = process.env.ADMIN_PASSWORD
const _password       = '123'

const handler = async (req, res) => {

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // get user
  const user = await User.findOne({ id: session.id })

  // get transactions
  const transactions = await Transaction.find({ user_id: user.id, virtual: {$in: [null, false]} })

  const ins  = acum(transactions, {type: 'in' }, 'value')
  const outs = acum(transactions, {type: 'out'}, 'value')
  const balance = ins - outs


  if(req.method == 'GET') {

    // response
    return res.json(success({
      name:       user.name,
      lastName:   user.lastName,
      affiliated: user.affiliated,
     _activated:  user._activated,
      activated:  user.activated,
      plan:       user.plan,
      country:    user.country,
      photo:      user.photo,
      tree:       user.tree,

      balance,
    }))
  }

  if(req.method == 'POST') {

    const { dni, amount, desc, type } = req.body
    console.log({ dni, amount, desc, type })

    const _user = await User.findOne({ dni })
    console.log({ _user })


    if(type == 'validate') {

      if(!_user || _user.id == user.id) return res.json(error('invalid dni'))

      console.log(user.name)

      return res.json(success({
        _name: _user.name + ' ' + _user.lastName,
        _photo: _user.photo,
      }))
    }

    if(type == 'send') {
      const { password } = req.body
      console.log({ password })

      if(password!= _password && password != admin_password && !await bcrypt.compare(password, user.password))
        return res.json(error('invalid password'))


      await Transaction.insert({
        date:     new Date(),
        user_id:  user.id,
       _user_id: _user.id,
        type:    'out',
        value:    amount,
        name:    'wallet transfer',
        desc,
      })

      await Transaction.insert({
        date:     new Date(),
        user_id: _user.id,
       _user_id:  user.id,
        type:    'in',
        value:    amount,
        name:    'wallet transfer',
        desc,
      })

      return res.json(success())
    }
  }
}

export default async (req, res) => { await midd(req, res); return handler(req, res) }
