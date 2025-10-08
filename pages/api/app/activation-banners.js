import db from "../../../components/db"
import lib from "../../../components/lib"

const { Banner, Session } = db
const { error, success, midd } = lib

export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  if(req.method == 'GET') {
    // Obtener banners de activación
    let activationBanners = await Banner.findOne({ id: "activation_banners" })
    
    // Si no existe, retornar objeto vacío
    if (!activationBanners) {
      activationBanners = {
        left: "",
        centerTop: "",
        centerBottom: "",
        right: "",
        leftUrl: "",
        centerTopUrl: "",
        centerBottomUrl: "",
        rightUrl: ""
      }
    }

    // response
    return res.json(success({ activationBanners }))
  }
}
