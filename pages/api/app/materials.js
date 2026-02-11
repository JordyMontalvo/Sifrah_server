import db from "../../../components/db"
import lib from "../../../components/lib"

const { Material } = db
const { success, midd } = lib

export default async (req, res) => {
    await midd(req, res)

    if (req.method == 'GET') {
        const materials = await Material.find({})
        return res.json(success({ materials }))
    }
}
