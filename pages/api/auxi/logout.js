import db  from "../../../components/db"
import lib from "../../../components/lib"

const { Session } = db
const { midd } = lib


const Logout = async (req, res) => {

  let { session } = req.body

  await Session.delete(session)

  return res.end()
}

export default async (req, res) => { await midd(req, res); return Logout(req, res) }
