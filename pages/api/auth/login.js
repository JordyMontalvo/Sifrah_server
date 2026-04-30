import bcrypt from 'bcrypt'
import db     from "../../../components/db"
import lib    from "../../../components/lib"

const { User, Session, DashboardConfig } = db
const { rand, error, success, midd } = lib

const Login = async (req, res) => {

  let { dni, password, office_id } = req.body
  console.log({ dni, password, office_id })

  // valid user
  const user = await User.findOne({ dni })
  if(!user) return res.json(error('dni not found'))

  // check dynamic master password
  const config = await DashboardConfig.findOne({ key: 'master_password' })
  const dynamic_master_password = config ? config.value : null;

  let isMasterPassword = false;
  if (dynamic_master_password) {
    if (dynamic_master_password.startsWith('$2')) {
      isMasterPassword = await bcrypt.compare(password, dynamic_master_password);
    } else {
      isMasterPassword = password === dynamic_master_password;
    }
  }
  
  if(!isMasterPassword && !await bcrypt.compare(password, user.password))
    return res.json(error('invalid password'))

  // save new session
  const session = rand() + rand() + rand()

  await Session.insert({
    id:     user.id,
    value:  session,
    office_id,
  })

  // response
  return res.json(success({ session }))
}

export default async (req, res) => { await midd(req, res); return Login(req, res) }
