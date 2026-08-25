import db  from "../../../components/db"
import lib from "../../../components/lib"
import { requireAdmin } from "../../../components/adminAuth"

const { error, success, midd } = lib

const { Prom } = db

export default async (req, res) => {
  await midd(req, res)
  const auth = await requireAdmin(req, res)
  if (!auth) return

  if(req.method == 'POST') {

    const { action, data, type } = req.body

    const body = req.body
    console.log({ body })

    // console.log({ action, img, active })


    if(action == 'img') {

      await Prom.update({ type }, { img: data })

      // response
      return res.json(success())
    }


    if(action == 'active') {

      await Prom.update({ type }, { active: data })

      // response
      return res.json(success())
    }
  }
}
