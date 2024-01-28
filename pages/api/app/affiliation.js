import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Plan, Product, Affiliation, Office, Tree, Transaction } = db
const { error, success, midd, rand, acum } = lib

let tree

let pay_basic    = 0
let pay_standard = 0
let pay_business = 0
let pay_master   = 0


function total_pay(id, parent_id) {
  const node = tree.find(e => e.id == id)

  let val = 0

  if(node.parentId == parent_id && !node.closeds) {

    if(node.plan == 'basic')    val = 50
    if(node.plan == 'standard') val = 150
    if(node.plan == 'business') val = 300
    if(node.plan == 'master')   val = 500
  }

  pay_basic    += 0.2 * val
  pay_standard += 0.4 * val
  pay_business += 0.4 * val
  pay_master   += 0.4 * val

  node.childs.forEach(_id => {
    total_pay(_id, parent_id)
  })
}


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
  const products = await Product.find({ aff_price: {$exists: true }})


  // get last AFFILIATION pending or approved
  const affiliation  = await Affiliation.findOneLast({ userId: user.id, status: { $in: ['pending', 'approved'] } })
  const affiliations = await Affiliation.find({ userId: user.id, status: 'approved' })


  if(affiliation && affiliation.status == 'approved') {
    if(affiliation.plan.id == 'basic') {
      plans.shift()
    }
    if(affiliation.plan.id == 'standard') {
      plans.shift()
      plans.shift()
    }
    if(affiliation.plan.id == 'business') {
      plans.shift()
      plans.shift()
      plans.shift()
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


  if(user.plan == 'default') {

    const users = await User.find({ tree: true })
          tree  = await Tree.find({})

    tree.forEach(node => {

      const user = users.find(e => e.id == node.id)

      node.plan               = user.plan
      node.affiliation_points = user.affiliation_points
      node.parentId           = user.parentId
      node.closeds            = user.closeds ? true : false
    })

    pay_basic    = 0
    pay_standard = 0
    pay_business = 0
    pay_master   = 0


    const node = tree.find(e => e.id == user.id)

    node.childs.forEach(_id => {
      total_pay(_id, node.id)
    })

    plans[0].pay = pay_basic
    plans[1].pay = pay_standard
    plans[2].pay = pay_business
    plans[3].pay = pay_master

  }


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

    let { products, price, final_plan, voucher, office, check, remaining, pay_method, bank, date, voucher_number } = req.body

    const plan = plans.find(e => e.id == final_plan); console.log({ plan })

    if(user.plan == 'default') {

      let transactions = []
      let amounts

      if(!check) {
        const pay   = plan.pay

        const a = balance < price ? balance : price
        const r = (price - balance) > 0 ? price - balance : 0
        const b = pay < r ? pay : r
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
          })
        }
      }

      await Affiliation.insert({
        id:     rand(),
        date:   new Date(),
        userId: user.id,
        products,
        price,
        plan,
        voucher,
        office,
        status: 'pending',
        delivered: false,

        transactions,
        amounts,

        remaining,
        pay_method,
        bank,
        voucher_date: date,
        voucher_number,
      })

    } else {

      let transactions = []
      let amounts

      if(!check) {

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
        price,
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
      })
    }

    return res.json(success())
  }
}
