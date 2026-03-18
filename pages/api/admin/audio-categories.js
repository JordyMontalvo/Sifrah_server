import db from "../../../components/db";
import lib from "../../../components/lib";

const { AudioCategory } = db;
const { midd, success, rand } = lib;
const { applyCORS } = require("../../../middleware/middleware-cors");

export default async (req, res) => {
    await midd(req, res);
    if (req.method === "OPTIONS") return res.status(200).end();

    if (req.method == "GET") {
        try {
            let categories = await AudioCategory.find({});
            return res.json(success({ categories }));
        } catch (error) {
            console.error("Error in GET /admin/audio-categories:", error);
            return res.status(500).json({ error: true, msg: error.message || "Internal Server Error" });
        }
    }

    if (req.method == "POST") {
        try {
            const { action } = req.body;

            if (action == "add") {
                const { name } = req.body.data || {};

                if (!name) {
                    return res.json({ error: true, msg: "Name is required" });
                }

                await AudioCategory.insert({
                    id: rand(),
                    name,
                    created_at: new Date(),
                });
            } else if (action == "delete") {
                const { id } = req.body;
                if (!id) return res.json({ error: true, msg: "ID is required" });
                await AudioCategory.delete({ id });
            }

            return res.json(success({}));
        } catch (error) {
            console.error("Error in POST /admin/audio-categories:", error);
            return res.status(500).json({ error: true, msg: error.message || "Internal Server Error" });
        }
    }

    if (req.method == "DELETE") {
        try {
            const { id } = req.body;
            if (!id) return res.json({ error: true, msg: "ID is required" });
            await AudioCategory.delete({ id });
            return res.json(success({ message: "Category deleted successfully" }));
        } catch (error) {
            console.error("Error in DELETE /admin/audio-categories:", error);
            return res.status(500).json({ error: true, msg: error.message || "Internal Server Error" });
        }
    }
};
