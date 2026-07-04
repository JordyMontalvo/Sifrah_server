import bcrypt from 'bcrypt'
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

  const user = await User.findOne({ id: session.id })


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

    if (!oldPassword || !newPassword) {
      return res.json(error('missing fields'))
    }

    if (String(newPassword).length < 4) {
      return res.json(error('weak password'))
    }

    let validOldPassword = false
    if (user.password) {
      try {
        validOldPassword = await bcrypt.compare(String(oldPassword), user.password)
      } catch {
        validOldPassword = false
      }
    }

    if (!validOldPassword) {
      return res.json(error('invalid password'))
    }

    const password = await bcrypt.hash(String(newPassword), 12)

    // update user
    await User.update({ id: user.id }, { password })

    // response
    return res.json(success())
  }
}
