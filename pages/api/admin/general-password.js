import bcrypt from 'bcrypt'
import db from "../../../components/db"
import lib from "../../../components/lib"
import { requireAdmin } from "../../../components/adminAuth"

const { DashboardConfig } = db
const { error, success, midd } = lib

import { getOfficeLoginPassword } from "../../../components/master-password"

const GeneralPassword = async (req, res) => {
  if (req.method === 'GET') {
    let config = await DashboardConfig.findOne({ key: 'master_password' })
    return res.json(success({ 
      data: {
        configured: !!config,
        updated_at: config ? config.updated_at : null 
      },
      office_password: getOfficeLoginPassword(),
    }))
  }

  if (req.method === 'POST') {
    let { newPassword } = req.body
    if (!newPassword) return res.json(error('Password is required'))

    const hashed_password = await bcrypt.hash(newPassword, 10);

    let config = await DashboardConfig.findOne({ key: 'master_password' })
    if (config) {
      await DashboardConfig.update({ key: 'master_password' }, { 
        value: hashed_password,
        updated_at: new Date().toISOString()
      })
    } else {
      await DashboardConfig.insert({ 
        key: 'master_password', 
        value: hashed_password,
        updated_at: new Date().toISOString()
      })
    }
    return res.json(success({ msg: 'Password updated' }))
  }
}

export default async (req, res) => {
  await midd(req, res);
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  return GeneralPassword(req, res);
};
