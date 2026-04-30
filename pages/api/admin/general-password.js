import db from "../../../components/db"
import lib from "../../../components/lib"

const { DashboardConfig } = db
const { error, success, midd } = lib

const GeneralPassword = async (req, res) => {
  if (req.method === 'GET') {
    let config = await DashboardConfig.findOne({ key: 'master_password' })
    return res.json(success({ 
      data: {
        configured: !!config,
        updated_at: config ? config.updated_at : null 
      }
    }))
  }

  if (req.method === 'POST') {
    let { newPassword } = req.body
    if (!newPassword) return res.json(error('Password is required'))

    let config = await DashboardConfig.findOne({ key: 'master_password' })
    if (config) {
      await DashboardConfig.update({ key: 'master_password' }, { 
        value: newPassword,
        updated_at: new Date().toISOString()
      })
    } else {
      await DashboardConfig.insert({ 
        key: 'master_password', 
        value: newPassword,
        updated_at: new Date().toISOString()
      })
    }
    return res.json(success({ msg: 'Password updated' }))
  }
}

export default async (req, res) => {
  await midd(req, res);
  return GeneralPassword(req, res);
};
