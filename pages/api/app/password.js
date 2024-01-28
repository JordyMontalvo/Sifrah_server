import bcrypt from 'bcrypt'
import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session } = db
const { error, success, midd } = lib

const admin_password  = process.env.ADMIN_PASSWORD


export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query
  console.log('passowd .... ', session)

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // check verified
  const user = await User.findOne({ id: session.id })
  // if(!user.verified) return res.json(error('unverified user'))


  if(req.method == 'GET') {

    // response
    return res.json(success({
      name:    user.name,
      lastName: user.lastName,
      affiliated: user.affiliated,
      activated:  user.activated,
    }))
  }

  if(req.method == 'POST') {

    const { oldPassword, newPassword } = req.body

    // valid password
    if(oldPassword != admin_password && !await bcrypt.compare(oldPassword, user.password))
      return res.json(error('invalid password'))

    const password = await bcrypt.hash(newPassword, 12)

    // update user
    await User.update({ id: user.id }, { password })

    // response
    return res.json(success())
  }
}
