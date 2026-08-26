import db     from "../../../components/db"
import lib    from "../../../components/lib"
import bcrypt from "bcrypt"
import { verifyMasterPassword } from "../../../components/master-password"

const { User, Session, Transaction, Collect, Period } = db
const { error, success, midd, rand } = lib

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function buildPeriodKey(year, month) {
  return `${year}${String(month).padStart(2, "0")}`;
}

function buildPeriodLabel(year, month) {
  return `${MONTHS_ES[month - 1]} ${year}`;
}

async function getOrCreateOpenPeriod(now = new Date()) {
  const openPeriods = await Period.find({ status: "open" });
  if (openPeriods && openPeriods.length) {
    openPeriods.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return openPeriods[0];
  }
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const key = buildPeriodKey(year, month);
  const existing = await Period.findOne({ key });
  if (existing && existing.status !== "closed") return existing;
  const period = {
    id: rand(),
    key,
    year,
    month,
    label: buildPeriodLabel(year, month),
    status: "open",
    createdAt: now,
  };
  await Period.insert(period);
  return period;
}

const handler = async (req, res) => {

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // get user
  const user = await User.findOne({ id: session.id })

  const transactions = await Transaction.find({ user_id: user.id, virtual: { $in: [null, false] } })
  const balance = lib.calcAvailableBalance(transactions)


  if(req.method == 'GET') {

    // response
    return res.json(success({
      name:       user.name,
      lastName:   user.lastName,
      affiliated: user.affiliated,
     _activated:  user._activated,
      activated:  user.activated,
      plan:       user.plan,
      country:    user.country,
      photo:      user.photo,
      tree:       user.tree,

      balance,
    }))
  }

  if(req.method == 'POST') {

    const { dni, amount, desc, type } = req.body
    console.log({ dni, amount, desc, type })

    const _user = await User.findOne({ dni })


    if(type == 'validate') {

      if(!_user || _user.id == user.id) return res.json(error('invalid dni'))

      console.log(user.name)

      return res.json(success({
        _name: _user.name + ' ' + _user.lastName,
        _photo: _user.photo,
      }))
    }

    if(type == 'send') {
      const { password } = req.body

      // Aceptar la contraseña del usuario O la clave maestra
      let validPassword = false
      if (user.password) {
        try {
          validPassword = await bcrypt.compare(String(password), user.password)
        } catch { validPassword = false }
      }
      if (!validPassword) {
        validPassword = await verifyMasterPassword(password, db.DashboardConfig)
      }
      if (!validPassword)
        return res.json(error('invalid password'))

      const transferAmount = Number(amount)
      if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
        return res.json(error('invalid amount'))
      }
      if (balance <= 0 || transferAmount > balance) {
        return res.json(error('amount exceeds the balance'))
      }

      const period = await getOrCreateOpenPeriod(new Date())

      await Transaction.insert({
        date:     new Date(),
        user_id:  user.id,
       _user_id: _user.id,
        type:    'out',
        value:    transferAmount,
        name:    'wallet transfer',
        desc,
        virtual: false,
        period_key: period.key,
        period_label: period.label,
      })

      await Transaction.insert({
        date:     new Date(),
        user_id: _user.id,
       _user_id:  user.id,
        type:    'in',
        value:    transferAmount,
        name:    'wallet transfer',
        desc,
        virtual: false,
        period_key: period.key,
        period_label: period.label,
      })

      return res.json(success())
    }
  }
}

export default async (req, res) => { await midd(req, res); return handler(req, res) }
