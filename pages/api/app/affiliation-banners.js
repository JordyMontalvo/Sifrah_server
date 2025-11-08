import db from "../../../components/db"
import lib from "../../../components/lib"

const { Banner, Session } = db
const { error, success, midd } = lib

const AFFILIATION_BANNER_ID = "affiliation_banners"

export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  session = await Session.findOne({ value: session })
  if (!session) return res.json(error("invalid session"))

  if (req.method === "GET") {
    let affiliationBanners = await Banner.findOne({ id: AFFILIATION_BANNER_ID })

    if (!affiliationBanners) {
      affiliationBanners = {
        hero: "",
        kit: "",
      }
    }

    return res.json(success({ affiliationBanners }))
  }
}

