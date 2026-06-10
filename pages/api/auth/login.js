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

  if (user.status === 'eliminated') {
    return res.json({
      error: true,
      code: 'ACCOUNT_ELIMINATED',
      msg: 'Tu cuenta fue dada de baja por inactividad. Contacta al soporte para reactivarla.',
    })
  }

  if (user.status === 'blocked') {
    return res.json({ 
      error: true, 
      code: 'ACCOUNT_BLOCKED', 
      dni: user.dni,
      msg: 'Tu cuenta ha sido bloqueada. Contacta al soporte o administrador para más detalles.'
    })
  }

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

  // Basic parsing for OS and Browser
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const user_agent = req.headers['user-agent'] || '';
  
  let os = 'Desconocido';
  if (user_agent.includes('Win')) os = 'Windows';
  else if (user_agent.includes('Mac') && !user_agent.includes('iPhone') && !user_agent.includes('iPad')) os = 'MacOS';
  else if (user_agent.includes('Linux') && !user_agent.includes('Android')) os = 'Linux';
  else if (user_agent.includes('Android')) os = 'Android';
  else if (user_agent.includes('iPhone') || user_agent.includes('iPad')) os = 'iOS';

  let browser = 'Desconocido';
  if (user_agent.includes('Edg')) browser = 'Edge';
  else if (user_agent.includes('Chrome')) browser = 'Chrome';
  else if (user_agent.includes('Firefox')) browser = 'Firefox';
  else if (user_agent.includes('Safari') && !user_agent.includes('Chrome')) browser = 'Safari';

  // save new session
  const session = rand() + rand() + rand()

  await Session.insert({
    id:     user.id,
    value:  session,
    office_id,
    ip,
    user_agent,
    os,
    browser,
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString()
  })

  return res.json(success({
    session,
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    photo: user.photo,
    plan: user.plan,
    affiliated: user.affiliated,
    activated: user.activated,
    _activated: user._activated,
    country: user.country,
    tree: user.tree,
    total_points: user.total_points,
  }))
}

export default async (req, res) => { await midd(req, res); return Login(req, res) }
