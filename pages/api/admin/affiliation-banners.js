import db from "../../../components/db"
import lib from "../../../components/lib"

const { Banner } = db
const { error, success, midd } = lib

const AFFILIATION_BANNER_ID = "affiliation_banners"
const VALID_POSITIONS = ["hero", "kit"]

export default async (req, res) => {
  await midd(req, res)

  if (req.method === "GET") {
    let affiliationBanners = await Banner.findOne({ id: AFFILIATION_BANNER_ID })

    if (!affiliationBanners) {
      affiliationBanners = {
        id: AFFILIATION_BANNER_ID,
        hero: "",
        kit: "",
      }
      await Banner.insert(affiliationBanners)
    }

    return res.json(success({ affiliationBanners }))
  }

  if (req.method === "POST") {
    const { id, img, position } = req.body

    if (id !== AFFILIATION_BANNER_ID) {
      return res.json(error("Identificador inválido para banners de afiliación"))
    }

    if (!VALID_POSITIONS.includes(position)) {
      return res.json(error("Posición de banner de afiliación no válida"))
    }

    if (!img || typeof img !== "string") {
      return res.json(error("La imagen del banner es requerida"))
    }

    const updateData = { [position]: img }
    const existingBanner = await Banner.findOne({ id: AFFILIATION_BANNER_ID })

    if (existingBanner) {
      await Banner.update({ id: AFFILIATION_BANNER_ID }, updateData)
    } else {
      await Banner.insert({
        id: AFFILIATION_BANNER_ID,
        hero: "",
        kit: "",
        ...updateData,
      })
    }

    return res.json(success())
  }
}

