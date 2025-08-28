import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Activation, Product } = db
const { error, success, midd } = lib


// function light(a, b, c) {

//   if(a != null && b != null && c != null) {

//     if(a >= 250 && b >= 450)
//       if(c >= 650) return [1, 1, 1]
//       else         return [1, 1, 0]
//   }

//   if (b != null && c != null) {

//     if(b >= 250)
//       if(c >= 450) return [1, 1, 0]
//       else         return [1, 0, 0]
//   }

//   if(c >= 250) return [1, 0, 0]
//   else         return [0, 0, 0]
// }



export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // check verified
  const user = await User.findOne({ id: session.id })
  // if(!user.verified) return res.json(error('unverified user'))

  // obtener catálogo de productos con subdescription
  const products = await Product.find({})
  console.log("[API App Activations] Productos obtenidos:", products.map(p => ({ id: p.id, name: p.name, subdescription: p.subdescription })));
  console.log("[API App Activations] Estructura completa del primer producto:", products.length > 0 ? products[0] : "No hay productos");
  console.log("[API App Activations] Campos disponibles en productos:", products.length > 0 ? Object.keys(products[0]) : "No hay productos");

  if(req.method == 'GET') {

    // get activations
    const activations = await Activation.find({ userId: user.id })

    // const all_points = user.all_points
    // const n = all_points.length

    // const a = (n >= 3 && !all_points[n-3].payed) ? all_points[n-3].val : null
    // const b = (n >= 2 && !all_points[n-2].payed) ? all_points[n-2].val : null
    // const c = (n >= 1 && !all_points[n-1].payed) ? all_points[n-1].val : null

    // console.log({ a, b, c})

    // let arr = light(a, b, c)


    // response
    return res.json(success({
      name:       user.name,
      lastName: user.lastName,
      affiliated: user.affiliated,
      activated:  user.activated,
      plan:       user.plan,
      country:    user.country,
      photo:      user.photo,
      tree:       user.tree,

              activations,
        products,
        // arr,
    }))
  }
}
