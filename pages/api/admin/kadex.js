import db from "../../../components/db"
import lib from "../../../components/lib"
import { requireAdmin } from "../../../components/adminAuth"

const { Product, Recharge, Affiliation, Activation } = db
const { midd, success, rand } = lib


export default async (req, res) => {
  await midd(req, res)
  const auth = await requireAdmin(req, res)
  if (!auth) return

  if(req.method == 'GET') {

    let products = await Product.find({})
    let recharges = await Recharge.find({})
    let affiliations = await Affiliation.find({})
    let activations = await Activation.find({})

    // response
    return res.json(success({
      products,
      recharges,
      affiliations,
      activations,
    }))
  }
}
