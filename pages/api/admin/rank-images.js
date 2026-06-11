import db from "../../../components/db"
import lib from "../../../components/lib"
import {
  RANK_IMAGE_ID,
  VALID_RANK_IMAGE_KEYS,
  emptyRankImagesDoc,
} from "../../../lib/rankImages"

const { Banner } = db
const { error, success, midd } = lib

export default async (req, res) => {
  await midd(req, res)

  if (req.method === "GET") {
    let rankImages = await Banner.findOne({ id: RANK_IMAGE_ID })

    if (!rankImages) {
      rankImages = emptyRankImagesDoc()
      await Banner.insert(rankImages)
    }

    return res.json(success({ rankImages }))
  }

  if (req.method === "POST") {
    const { id, img, position } = req.body

    if (id !== RANK_IMAGE_ID) {
      return res.json(error("Identificador inválido para imágenes de rangos"))
    }

    if (!VALID_RANK_IMAGE_KEYS.includes(position)) {
      return res.json(error("Rango no válido"))
    }

    if (!img || typeof img !== "string") {
      return res.json(error("La imagen es requerida"))
    }

    const updateData = { [position]: img }
    const existing = await Banner.findOne({ id: RANK_IMAGE_ID })

    if (existing) {
      await Banner.update({ id: RANK_IMAGE_ID }, updateData)
    } else {
      await Banner.insert({
        ...emptyRankImagesDoc(),
        ...updateData,
      })
    }

    return res.json(success())
  }
}
