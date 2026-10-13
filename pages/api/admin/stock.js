import db from "../../../components/db"
import lib from "../../../components/lib"
import { requireAdmin } from "../../../components/adminAuth"

const { Office, Product, OfficeCollect } = db
const { success, midd, rand } = lib


export default async (req, res) => {

  // secure middleware
  await midd(req, res)
  const auth = await requireAdmin(req, res)
  if (!auth) return


  if(req.method == 'GET') {

    const { id } = req.query

    // get products
    let office = await Office.findOne({ id })
    const products = await Product.find({})


    office.products = office.products.map(p => {
      const product = products.find(e => e.id == p.id)
      p.name = product.name

      return p
    })

    // response
    return res.json(success({ office }))

  }

  if(req.method == 'POST') {

    const { id, amount } = req.body

    // Se exige texto en el identificador y un numero de verdad en el importe.
    // Si entraba un texto, la resta de abajo daba 'NaN' y la ganancia de la
    // oficina quedaba inservible para siempre, sin aviso ninguno.
    if (typeof id !== 'string' || !id.trim()) {
      return res.json(lib.error('oficina invalida'))
    }

    const importe = Number(amount)
    if (!Number.isFinite(importe) || importe <= 0) {
      return res.json(lib.error('importe invalido'))
    }

    let office = await Office.findOne({ id: id.trim() })
    if (!office) return res.json(lib.error('oficina no encontrada'))

    const _id = rand()

    // save new collect
    await OfficeCollect.insert({
      id: _id,
      date: new Date(),
      office,
      amount: importe,
      status: 'pending',
    })

    const profit = Number(office.profit || 0) - importe

    await Office.update({ id: id.trim() }, { profit })

    return res.json(success())
  }
}
