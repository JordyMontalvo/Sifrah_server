import db from "../../../components/db"
import lib from "../../../components/lib"

const { Book } = db
const { success, midd } = lib

export default async (req, res) => {
    await midd(req, res)

    if (req.method == 'GET') {
        // Return only active books for the mobile app
        const books = await Book.find({ active: true })
        return res.json(success({ books }))
    }
}
