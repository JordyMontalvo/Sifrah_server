import db  from "../../../components/db"
import lib from "../../../components/lib"
import { requireAdmin } from "../../../components/adminAuth";

const { Transaction, User, Period } = db
const { error, success, midd, rand } = lib

// Tope de seguridad para un pago suelto. Sobre los 3107 pagos ya registrados el
// mayor es de 3004 y la media de 38,58, asi que este limite deja mucho margen y
// solo frena un importe tecleado con ceros de mas.
const MAX_PAY_AMOUNT = Number(process.env.MAX_PAY_AMOUNT) || 50000


export default async (req, res) => {
  await midd(req, res)
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if(req.method == 'GET') {
    const users = await User.find({})

    let pays = await Transaction.find({ name: 'pay' })

    for (let p of pays) {
      const user = users.find(e => e.id == p.user_id)
      p.user = user
    }

    return res.json(success({
      pays,
    }))
  }

  if(req.method == 'POST') {

    const { dni, amount, desc, period_key } = req.body
    console.log({ amount, desc, period_key })

    if (!period_key) {
      return res.json(error('period_key is required'))
    }

    // El importe entra en la contabilidad del socio: hasta ahora un parseFloat
    // suelto admitia texto (NaN), negativos y cifras sin tope.
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      return res.json(error('invalid amount'))
    }
    if (value > MAX_PAY_AMOUNT) {
      return res.json(error('amount exceeds limit'))
    }

    const period = await Period.findOne({ key: period_key })
    if (!period) {
      return res.json(error('period not found'))
    }

    // Sin convertir a texto, un objeto como {"$ne": null} convierte la busqueda
    // en un comodin y el pago acaba cayendo en un socio elegido por la base.
    const user = await User.findOne({ dni: String(dni ?? '').trim() })

    if(!user) return res.json(error('dni not found'))

    await Transaction.insert({
      id:      rand(),
      date:    new Date(),
      user_id: user.id,
      type:   'in',
      value,
      desc,
      virtual: false,
      name: 'pay',
      period_key: period.key,
      period_label: period.label || period.key,
    })

    return res.json(success())
  }
}
