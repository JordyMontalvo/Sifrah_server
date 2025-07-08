import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Plan, Product, Affiliation, Office, Tree, Transaction } = db
const { error, success, midd, rand, acum } = lib

let tree


export default async (req, res) => {
  await midd(req, res)

  // valid session
  let { session } = req.query
        session   = await Session.findOne({ value: session })
  if  (!session)    return res.json(error('invalid session'))

  // get USER
  const user = await User.findOne({ id: session.id })

  // get PLANS
  let plans = await Plan.find({})

  // get PRODUCTS
  const products = await Product.find({})


  // get last AFFILIATION pending or approved
  const affiliation  = await Affiliation.findOneLast({ userId: user.id, status: { $in: ['pending', 'approved'] } })
  const affiliations = await Affiliation.find({ userId: user.id, status: 'approved' })

  // tabla de pago
  plans[0].table_pay = [90, 20, 5, 3, 3, 1.5, 1.5, 1.5, 1.5]
  plans[1].table_pay = [300, 50, 20, 10, 10, 5, 5, 5, 5]
  plans[2].table_pay = [500, 100, 60, 40, 20, 10, 10, 10, 10]

  if(affiliation && affiliation.status == 'approved') {

    if(affiliation.plan.id == 'basic') {

      plans.shift()

      plans[0].amount =  // basic -> standard
      plans[1].amount =  // basic -> master

      plans[0].affiliation_points =  // basic -> standard
      plans[1].affiliation_points =  // basic -> master

      // resta peso

      // calcula tabla de pago
      plans[0].table_pay = [210, 30, 15, 7, 7, 3.5, 3.5, 3.5, 3.5] // basic -> standard
      plans[1].table_pay = [410, 80, 55, 37, 17, 8.5, 8.5, 8.5, 8.5] // basic -> master
    }

    if(affiliation.plan.id == 'standard') {
      plans.shift()
      plans.shift()

      plans[0].amount =  // standard -> master
      plans[0].affiliation_points =  // standard -> master

      // calcula tabla de pago
      plans[0].table_pay = [200, 50, 40, 30, 10, 5, 5, 5, 5] // standard -> master
    }

    if(affiliation.plan.id == 'master') {
      plans = []
    }
  }


  // get transactions
  const  transactions = await Transaction.find({ user_id: user.id, virtual: {$in: [null, false]} })
  const _transactions = await Transaction.find({ user_id: user.id, virtual:              true    })

  const  ins  = acum( transactions, {type: 'in' }, 'value')
  const  outs = acum( transactions, {type: 'out'}, 'value')
  const _ins  = acum(_transactions, {type: 'in' }, 'value')
  const _outs = acum(_transactions, {type: 'out'}, 'value')

  const  balance =  ins -  outs
  const _balance = _ins - _outs


  if(req.method == 'GET') {

    const offices = await Office.find({})

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

      plans,
      products,
      affiliation,
      affiliations,
      offices,

      balance,
     _balance,
    }))
  }


  if(req.method == 'POST') {

    let { products, plan, voucher, office, check, pay_method, bank, date, voucher_number, table_pay } = req.body

    plan = plans.find(e => e.id == plan.id); console.log({ plan })

    let transactions = []
    let amounts

    if(!check) {

      const price = plan.amount

      const a = _balance < price ? _balance : price
      const r = (price - _balance) > 0 ? price - _balance : 0
      const b = balance < r ? balance : r
      const c = price - a - b
      console.log({ a, b, c })

      const id1 = rand()
      const id2 = rand()

      amounts = [a, b, c]

      if(a) {
        transactions.push(id1)

        await Transaction.insert({
          id:      id1,
          date:    new Date(),
          user_id:  user.id,
          type:   'out',
          value:   a,
          name:   'affiliation',
          virtual: true,
        })
      }

      if(b) {
        transactions.push(id2)

        await Transaction.insert({
          id:      id2,
          date:    new Date(),
          user_id:  user.id,
          type:   'out',
          value:   b,
          name:   'affiliation',
          virtual: false,
        })
      }
    }

    await Affiliation.insert({
      id:     rand(),
      date:   new Date(),
      userId: user.id,
      products,
      plan,
      voucher,
      office,
      status: 'pending',
      delivered: false,

      transactions,
      amounts,

      pay_method,
      bank,
      voucher_date: date,
      voucher_number,
      table_pay,
    })

    return res.json(success())
  }
}
