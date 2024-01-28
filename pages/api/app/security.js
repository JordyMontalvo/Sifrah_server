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

  // get USER
  const user = await User.findOne({ id: session.id })


  if(req.method == 'GET') {
  	console.log('security ...')
    // response
    return res.json(success({
      name:    	  user.name,
      lastName: user.lastName,
      affiliated: user.affiliated,
      activated:  user.activated,

      security:   user.security,
    }))
  }

  if(req.method == 'POST') {

    const { name, lastName, dni, relation, phone } = req.body

    const security = {
    	name,
    	lastName,
    	dni,
    	relation,
    	phone
    }

    // update user
    await User.update({ id: user.id }, { security })

    // response
    return res.json(success())
  }
}
