import db from "../../../components/db"
import lib from "../../../components/lib"

const { Office, Product, Recharge } = db
const { success, midd } = lib


export default async (req, res) => {
  await midd(req, res)

  let offices   = await Office.find({})
  let products  = await Product.find({})
  let recharges = await Recharge.find({})

  for (let office of offices) {
    for (let product of products) {
      const p = office.products.find(e => e.id == product.id)

      if(!p)
        office.products.push({
          id: product.id,
          total: 0,
        })
    }
  }

  if(req.method == 'GET') {

    offices = offices.map(office => {

      office.products = office.products.map(p => {
        const product = products.find(e => e.id == p.id)
        p.name = product.name

        return p
      })

      office.recharges = recharges.filter(r => r.office_id == office.id)

      return office
    })

    return res.json(success({ offices }))
  }

  if(req.method == 'POST') {

    const { id, products, office } = req.body
    // console.log({ products })

    if(products) {
      // const office = await Office.findOne({ id })
      const office = offices.find(e => e.id == id)
      // console.log(office)

      products.forEach((p, i) => {
        // console.log({ i , p })
        office.products[i].total += products[i].total
      })

      // console.log(office)

      await Office.update(
        { id },
        { products: office.products }
      )

      await Recharge.insert({
        date:    new Date(),
        office_id: id,
        products
      })

    }

    if(office) {
      console.log(' update office ', office)
      await Office.update(
        { id },
        {
          email:    office.email,
          password: office.password,
          name:     office.name,
          address:  office.address,
          accounts: office.accounts,
        }
      )
    }

    return res.json(success())
  }
}
