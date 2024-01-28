import db from "../../../components/db"
import lib from "../../../components/lib"

const { Product } = db
const { midd, success, rand } = lib


export default async (req, res) => {
  await midd(req, res)

  if(req.method == 'GET') {

    let products = await Product.find({})

    // response
    return res.json(success({
      products
    }))
  }

  if(req.method == 'POST') { ; console.log('POST ...')

    const { action } = req.body

    if (action == 'edit') { ; console.log('edit ...')

      const { id } = req.body
      const { _name, _type, _price, aff_price_check, val_check } = req.body.data

      await Product.update({ id }, {
        name: _name,
        type: _type,
        price: _price,
      })

      if(aff_price_check) {
        const { _aff_price } = req.body.data

        await Product.update({ id }, {
          aff_price: _aff_price,
        })
      } else {

        await Product.un_update({ id }, {
          aff_price: '',
        })
      }

      if(val_check) {
        const { _val } = req.body.data

        await Product.update({ id }, {
          val: _val,
        })
      } else {

        await Product.un_update({ id }, {
          val: '',
        })
      }
    }

    if (action == 'add') { ; console.log('add ...')

      const { name, type, price, aff_price_check, aff_price } = req.body.data

      if(aff_price_check) {
        await Product.insert({
          id: rand(),
          name: name,
          type: type,
          price,
          aff_price,
        })
      } else {
        await Product.insert({
          id: rand(),
          name: name,
          type: type,
          price
        })
      }
    }

    // response
    return res.json(success({}))
  }
}
