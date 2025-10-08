import db from "../../../components/db"
import lib from "../../../components/lib"

const { Banner, User } = db
const { error, success, midd } = lib

export default async (req, res) => {
  await midd(req, res)

  if(req.method == 'GET') {
    // Obtener banners de activación
    let activationBanners = await Banner.findOne({ id: "activation_banners" })
    
    // Si no existe, crear uno vacío
    if (!activationBanners) {
      activationBanners = {
        id: "activation_banners",
        left: "",
        centerTop: "",
        centerBottom: "",
        right: "",
        leftUrl: "",
        centerTopUrl: "",
        centerBottomUrl: "",
        rightUrl: ""
      }
      await Banner.insert(activationBanners)
    }

    // response
    return res.json(success({ activationBanners }))
  }

  if(req.method == 'POST') {
    const { id, img, position, url } = req.body
    console.log({ id, img, position, url })

    // Actualizar el banner específico según la posición
    const updateData = {}
    if (img) {
      if (position === 'left') updateData.left = img
      if (position === 'centerTop') updateData.centerTop = img
      if (position === 'centerBottom') updateData.centerBottom = img
      if (position === 'right') updateData.right = img
    }

    if (typeof url === 'string') {
      if (position === 'left') updateData.leftUrl = url
      if (position === 'centerTop') updateData.centerTopUrl = url
      if (position === 'centerBottom') updateData.centerBottomUrl = url
      if (position === 'right') updateData.rightUrl = url
    }

    // Actualizar o insertar el documento
    const existingBanner = await Banner.findOne({ id: "activation_banners" })
    if (existingBanner) {
      await Banner.update({ id: "activation_banners" }, updateData)
    } else {
      const newBanner = {
        id: "activation_banners",
        left: "",
        centerTop: "",
        centerBottom: "",
        right: "",
        leftUrl: "",
        centerTopUrl: "",
        centerBottomUrl: "",
        rightUrl: "",
        ...updateData
      }
      await Banner.insert(newBanner)
    }

    return res.json(success())
  }
}
