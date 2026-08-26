import db  from "../../../components/db"
import lib from "../../../components/lib"
import { requireSession } from "../../../components/adminAuth"

const { Activation, Affiliation, User, Office, Product } = db
const { error, success, midd, model } = lib

// Solo lo que necesita una boleta: nunca el documento completo (incluia el hash bcrypt).
const INVOICE_USER_FIELDS = ['id', 'name', 'lastName', 'dni', 'email', 'phone', 'address']


const Invoice = async (req, res) => {

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
  const { id } = body

  // Un objeto aqui se convertiria en un operador de Mongo ({ "$ne": null }).
  if(id == null || typeof id === 'object') return res.json(error('invalid id'))

  // get activation
  const activation  = await Activation.findOne({ id })
  const affiliation = await Affiliation.findOne({ id })
  // console.log(activation)

  if(!activation && !affiliation) return res.json(error('invalid id'))

  // get products
  let products = activation ? activation.products : affiliation.plan.products
  // console.log(products)

  // products = products.filter(product => product.total > 0)
  // console.log(products)

  if(!activation) {
    console.log(products)

    const _products = await Product.find({})

    products.forEach(group => {
      group.list.forEach(product => {

        const p = _products.find(p => p.id == product.id)

        product.name  = p.name
        product.price = p.price
        console.log(product.name)
      })
    })

    products = products[0].list
  }

  products = products.filter(product => product.total > 0)


  const userId = activation ? activation.userId : affiliation.userId
  const user = await User.findOne({ id: userId })
  // console.log({ user })


  const office = activation ? await Office.findOne({ id: activation.office }) : await Office.findOne({ id: affiliation.office })


  // response
  return res.json(success({
    products,
    user: user ? model(user, INVOICE_USER_FIELDS) : null,
    office,
  }))
}

export default async (req, res) => {
  await midd(req, res)
  const auth = await requireSession(req, res)
  if (!auth) return
  return Invoice(req, res)
}
