import db from "../../../components/db"
import lib from "../../../components/lib"

const { Audio } = db
const { success, midd } = lib

export default async (req, res) => {
    await midd(req, res)

    if (req.method == 'GET') {
        // Return only active audios for the mobile app
        const audios = await Audio.find({ active: true })
        return res.json(success({ audios }))
    }
}
