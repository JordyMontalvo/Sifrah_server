import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session } = db
const { error, success, midd } = lib


export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // get user
  const user = await User.findOne({ id: session.id })


  if(req.method == 'GET') {

    const bank         = user.bank         ? user.bank         : null
    const account_type = user.account_type ? user.account_type : null
    const account      = user.account      ? user.account      : null
    const ibk          = user.ibk          ? user.ibk          : null

    // response
    return res.json(success({
      affiliated: user.affiliated,
     _activated:  user._activated,
      activated:  user.activated,
      plan:       user.plan,
      country:    user.country,
      photo:      user.photo,
      tree:       user.tree,

      country:      user.country,
      dni:          user.dni,
      name:         user.name,
      lastName:     user.lastName,
      email:        user.email,
      phone:        user.phone,
      birthdate:    user.birthdate,
      address:      user.address,
      token:        user.token,

      bank,
      account_type,
      account,
      ibk,
    }))
  }

  if(req.method == 'POST') {

    let { email, phone, age, address, bank, account_type, account, ibk } = req.body

    email = email ? email.toLowerCase().replace(/ /g,'') : ''

    // update user
    await User.update({ id: user.id }, { email, phone, age, address, bank, account_type, account, ibk })

    // response
    return res.json(success())
  }
}
