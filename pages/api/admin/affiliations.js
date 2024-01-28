import db  from "../../../components/db"
import lib from "../../../components/lib"

const { Affiliation, User, Tree, Token, Transaction, Office } = db
const { error, success, midd, ids, parent_ids, map, model, rand } = lib

// valid filters
// const q = { all: {}, pending: { status: 'pending'} }

const A = ['id',   'date',     'plan', 'voucher', 'status', 'office', 'delivered', 'remaining', 'pay_method', 'bank', 'voucher_date', 'voucher_number', 'amounts', 'price', 'products']
const U = ['name', 'lastName', 'dni', 'phone']


let users = null
let tree = null

const pay = {
  'basic'   : [0.1                         ],
  'standard': [0.2, 0.02, 0.02             ],
  'business': [0.3, 0.02, 0.05, 0.01       ],
  'master'  : [0.4, 0.02, 0.05, 0.01, 0.005],
}

let pays = []

let _affs

async function pay_bonus(id, arr, i, aff_id, amount, migration, plan, _id) {

  const user = users.find(e => e.id == id)
  const node =  tree.find(e => e.id == id)

  const virtual = user.activated ? false : true

  const name = migration ? 'migration bonus' : 'affiliation bonus'

  if(user.plan != 'default' && i <= (user.n - 1)) {

    let p = plan != 'basic' ? pay[user.plan][i] : 0.1

    const id = rand()

    await Transaction.insert({
      id,
      date:           new Date(),
      user_id:        user.id,
      type:          'in',
      value:          p * amount,
      name,
      affiliation_id: aff_id,
      virtual,
     _user_id:       _id,
    })

    pays.push(id)
  }

  if (i == 4 || !node.parent || plan == 'basic') return

  pay_bonus(node.parent, arr, i + 1, aff_id, amount, migration, plan, _id)
}


// async function pay_bonus_2(id, arr, i, aff, amount, plan, _id) {

//   if(!id) return

//   const user = users.find(e => e.id == id)
//   const node =  tree.find(e => e.id == id)

//   if(user.id == _id) {

//     if(i <= (aff.plan.n - 1)) {

//       let p = plan != 'basic' ? pay[user.plan][i] : 0.1

//       aff.pays.push(p * amount)
//     }
//   }

//   if (i == 4 || !node.parent || plan == 'basic') return

//   pay_bonus_2(node.parent, arr, i + 1, aff, amount, plan, _id)
// }

function pay_bonus_2(id, arr, i, aff, plan, _id) {

  if(!id) return

  const user = users.find(e => e.id == id)
  const node =  tree.find(e => e.id == id)
  const _aff = _affs.find(e => e.userId == id)

  if(user.id == _id) {

    if(i <= (aff.plan.n - 1)) {

      let p = plan != 'basic' ? pay[user.plan][i] : 0.1

      aff.pays.push(p * _aff.plan.amount)
    }
  }

  if (i == 4 || !node.parent || plan == 'basic') return

  pay_bonus_2(node.parent, arr, i + 1, aff, amount, plan, _id)
}

const handler = async (req, res) => {

  if(req.method == 'GET') {
    console.log('GET ...')
    // validate filter
    const { filter }    = req.query

    const q = { all: {}, pending: { status: 'pending'} }

    if (!(filter in q)) return res.json(error('invalid filter'))

    const { account }   = req.query

    // get AFFILIATIONS
    let qq = q[filter]

    if( account != 'admin') qq.office = account

    let affiliations = await Affiliation.find(qq)
    console.log('affiliations ...')

    // get USERS for affiliations
    let users = await User.find({ id: { $in: ids(affiliations) } })
    console.log('users ...')

        users = map(users)

    // enrich affiliations
    affiliations = affiliations.map(a => {

      let u = users.get(a.userId)

      a = model(a, A)
      u = model(u, U)

      return { ...a, ...u }
    })

    let parents = await User.find({ id: { $in: parent_ids(affiliations) } })
    console.log('parents ...')
    console.log(':) ...')


    return res.json(success({ affiliations }))
  }


  if(req.method == 'POST') {

    const { id, action } = req.body

    // get affiliation
    let affiliation = await Affiliation.findOne({ id })

    // validate affiliation
    if(!affiliation) return res.json(error('affiliation not exist'))

    if(action == 'approve' || action == 'reject') {
      if(affiliation.status == 'approved') return res.json(error('already approved'))
      if(affiliation.status == 'rejected') return res.json(error('already rejected'))
    }

    if(action == 'approve') {

      // approve AFFILIATION
      await Affiliation.update({ id }, { status: 'approved' })


      // update USER
      let user = await User.findOne({ id: affiliation.userId })

      await User.update({ id: user.id }, {
        affiliated:         true,
        activated:          true,
        affiliation_date:   new Date(),
        plan:               affiliation.plan.id,
        n:                  affiliation.plan.n,
        affiliation_points: affiliation.plan.affiliation_points,
      })

      const parent = await User.findOne({ id: user.parentId })

      // pay BONUS
      tree  = await Tree.find({})
      users = await User.find({})
      pays  = []

      if(user.plan == 'default') {

        // PAY AFFILIATION BONUS

        const plan   = affiliation.plan.id
        const amount = affiliation.plan.amount

        pay_bonus(user.parentId, pay, 0, affiliation.id, amount, false, plan, user.id)

        // .................................................................

        tree.forEach(node => {

          const _user = users.find(e => e.id == node.id)

          node.affiliated = _user.affiliated
        })


        _affs = await Affiliation.find({})

        affiliation.pays = []

        for(let node of tree) {
          if(node.affiliated) {

            const _user = users.find(e => e.id == node.id)
            console.log('user: ', _user.name)
            // pay_bonus_2(_user.parentId, pay, 0, affiliation, amount, _user.plan, user.id)
            pay_bonus_2(_user.parentId, pay, 0, affiliation, _user.plan, user.id)
          }
        }

        affiliation.plan.pay = affiliation.pays.reduce((a, b) => a + b, 0)

        // .................................................................


        const _pay = affiliation.plan.pay - (affiliation.amounts ? affiliation.amounts[1] : 0)
        console.log({ _pay })

        if(_pay > 0) {

          let _id = rand()

          await Transaction.insert({
            id:     _id,
            date:    new Date(),
            user_id: user.id,
            type:   'in',
            value:   affiliation.plan.pay,
            name:   'remaining',
            virtual: false,
          })

          pays.push(_id)

          _id = rand()

          await Transaction.insert({
            id:     _id,
            date:    new Date(),
            user_id: user.id,
            type:   'out',
            value:  (affiliation.amounts ? affiliation.amounts[1] : 0),
            name:   'remaining',
            virtual: false,
          })

          pays.push(_id)
        }

        if(_pay < 0 || _pay == 0) {

          let _id = rand()

          await Transaction.insert({
            id:     _id,
            date:    new Date(),
            user_id: user.id,
            type:   'in',
            value:   affiliation.plan.pay,
            name:   'remaining',
            virtual: false,
          })

          pays.push(_id)

          _id = rand()

          await Transaction.insert({
            id:     _id,
            date:    new Date(),
            user_id: user.id,
            type:   'out',
            value:   affiliation.plan.pay,
            name:   'remaining',
            virtual: false,
          })

          pays.push(_id)
        }

      } else {

        // PAY AFFILIATION BONUS

        const plan   = affiliation.plan.id
        const amount = affiliation.plan.amount

        pay_bonus(user.parentId, pay, 0, affiliation.id, amount, true, plan, user.id)
      }

      await Affiliation.update({ id }, { transactions: pays })


      // UPDATE STOCK
      console.log('UPDATE STOCK ...')
      const office_id = affiliation.office
      const products  = affiliation.products

      const office = await Office.findOne({ id: office_id })


      products.forEach((p, i) => {
        if(office.products[i]) office.products[i].total -= products[i].total
      })

      await Office.update({ id: office_id }, {
        products: office.products,
      })

      // migrar transaccinoes virtuales
      const transactions = await Transaction.find({ user_id: user.id, virtual: true })

      for(let transaction of transactions) {
        console.log({ transaction })
        await Transaction.update({ id: transaction.id }, { virtual: false })
      }

    }

    if(action == 'reject') {
      await Affiliation.update({ id }, { status: 'rejected' })

      // revert transactions
      if(affiliation.transactions) {

        for(let transactionId of affiliation.transactions) {
          await Transaction.delete({ id: transactionId })
        }
      }
    }

    if(action == 'check') {
      await Affiliation.update({ id }, { delivered: true })
    }

    if(action == 'uncheck') {
      await Affiliation.update({ id }, { delivered: false })

    }


    if(action == 'revert') { ; console.log('revert')

      const user = await User.findOne({ id: affiliation.userId })

      await Affiliation.delete({ id })

      const transactions = affiliation.transactions ; console.log(transactions)

      for(let id of transactions) {
        await Transaction.delete({ id })
      }

      const affiliations = await Affiliation.find({ userId: user.id, status: 'approved' })

      if(affiliations.length) {

        affiliation = affiliations[affiliations.length - 1]

        await User.update({ id: user.id }, {
          // affiliated: false,
          activated: false,
         _activated: false,
          plan: affiliation.plan.id,
          affiliation_date: affiliation.date,
          affiliation_points: affiliation.plan.affiliation_points,
          n: affiliation.plan.n,
        })

      } else {

        await User.update({ id: user.id }, {
          affiliated: false,
          activated: false,
         _activated: false,
          plan: 'default',
          affiliation_date: null,
          affiliation_points: 0,
          n: 0,
        })

      }

      // UPDATE STOCK
      console.log('UPDATE STOCK ...')
      const office_id = affiliation.office
      const products  = affiliation.products

      const office = await Office.findOne({ id: office_id })


      products.forEach((p, i) => {
        if(office.products[i]) office.products[i].total += products[i].total
      })

      await Office.update({ id: office_id }, {
        products: office.products,
      })
    }

    return res.json(success())
  }
}

export default async (req, res) => { await midd(req, res); return handler(req, res) }
