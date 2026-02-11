import db from "../../../components/db"
import lib from "../../../components/lib"

const { Material } = db
const { success, midd } = lib

export default async (req, res) => {
    try {
        await midd(req, res)

        if (req.method == 'GET') {
            const materials = await Material.find({})
            return res.json(success({ materials }))
        }

        if (req.method == 'POST') {
            const { action, id, data } = req.body

            if (action === 'create') {
                await Material.insert(data)
                return res.json(success())
            }

            if (action === 'update') {
                if (!id) return res.status(400).json({ error: true, msg: "ID is required" })

                const { _id, ...updateData } = data
                const { ObjectId } = require('mongodb')

                await Material.update({ _id: new ObjectId(id) }, updateData)
                return res.json(success())
            }

            if (action === 'delete') {
                if (!id) return res.status(400).json({ error: true, msg: "ID is required" })

                const { ObjectId } = require('mongodb')
                await Material.delete({ _id: new ObjectId(id) })
                return res.json(success())
            }
        }
    } catch (e) {
        console.error("Error in /api/admin/materials:", e)
        return res.status(500).json({ error: true, msg: e.message })
    }
}
