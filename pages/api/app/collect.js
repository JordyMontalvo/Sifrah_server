import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Transaction, Collect } = db
const { error, success, midd, rand } = lib


const handler = async (req, res) => {

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // check verified
  const user = await User.findOne({ id: session.id })
  // if(!user.verified) return res.json(error('unverified user'))

  const transactions = await Transaction.find({ user_id: user.id, virtual: { $in: [null, false] } })
  const balance = lib.calcAvailableBalance(transactions)
  const savingsBonusBalance = lib.calcSavingsBonusBalance(transactions)


  if(req.method == 'GET') {

    // response
    return res.json(success({
      name:       user.name,
      lastName: user.lastName,
      affiliated: user.affiliated,
      activated:  user.activated,
      plan:       user.plan,
      country:    user.country,
      photo:      user.photo,
      tree:       user.tree,

      bank:    user.bank,
      account: user.account,
      account_type: user.account_type,
      // ibk:     user.ibk,
      amount:  user.amount,
      balance,
      savingsBonusBalance,
    }))
  }

  if(req.method == 'POST') {

    const { cash, bank, account, account_type, amount, desc, office } = req.body

    const withdrawAmount = Number(amount)
    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
      return res.json(error("invalid amount"))
    }
    if (balance <= 0) {
      return res.json(error("amount exceeds the balance"))
    }
    if (withdrawAmount > balance) {
      return res.json(error("amount exceeds the balance"))
    }


    const id = rand()

    // save new collect
    await Collect.insert({
      date: new Date(),
      id,
      userId: user.id,
      cash,
      bank,
      account,
      account_type,
      amount: withdrawAmount,
      desc,
      office,
      status: 'pending',
    })

    await Transaction.insert({
      id:     rand(),
      date:   new Date(),
      user_id: user.id,
      type:  'out',
      value:  withdrawAmount,
      name:  'collect',
      desc,
      collectId: id,
      virtual: false,
    })

    // response
    return res.json(success())
  }
}

export default async (req, res) => { await midd(req, res); return handler(req, res) }
