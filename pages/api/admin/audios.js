import db from "../../../components/db";
import lib from "../../../components/lib";

const { Audio } = db;
const { midd, success, rand } = lib;
const { applyCORS } = require("../../../middleware/middleware-cors");

export default async (req, res) => {
    // Apply CORS
    applyCORS(req, res);

    // Handle preflight request
    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }

    await midd(req, res);

    if (req.method == "GET") {
        try {
            let audios = await Audio.find({});
            return res.json(success({ audios }));
        } catch (error) {
            console.error("Error in GET /admin/audios:", error);
            return res.status(500).json({ error: true, msg: error.message || "Internal Server Error" });
        }
    }

    if (req.method == "POST") {
        try {
            const { action } = req.body;

            if (action == "edit") {
                const { id } = req.body;
                if (!id) return res.json({ error: true, msg: "ID is required" });

                const { title, author, category, duration, url, image, description, active } = req.body.data || {};

                await Audio.update(
                    { id },
                    {
                        title,
                        author,
                        category,
                        duration,
                        url,
                        image,
                        description,
                        active: active !== undefined ? active : true,
                        updated_at: new Date(),
                    }
                );
            } else if (action == "add") {
                const { title, author, category, duration, url, image, description, active } = req.body.data || {};

                if (!title || !url) {
                    return res.json({ error: true, msg: "Title and URL are required" });
                }

                await Audio.insert({
                    id: rand(),
                    title,
                    author: author || "Equipo SIFRAH",
                    category: category || "General",
                    duration: duration || "00:00",
                    url,
                    image: image || "",
                    description: description || "",
                    active: active !== undefined ? active : true,
                    created_at: new Date(),
                    updated_at: new Date(),
                });
            } else if (action == "delete") {
                const { id } = req.body;
                if (!id) return res.json({ error: true, msg: "ID is required" });
                await Audio.delete({ id });
            }

            return res.json(success({}));
        } catch (error) {
            console.error("Error in POST /admin/audios:", error);
            return res.status(500).json({ error: true, msg: error.message || "Internal Server Error" });
        }
    }

    if (req.method == "DELETE") {
        try {
            const { id } = req.body;
            if (!id) return res.json({ error: true, msg: "ID is required" });
            await Audio.delete({ id });
            return res.json(success({ message: "Audio deleted successfully" }));
        } catch (error) {
            console.error("Error in DELETE /admin/audios:", error);
            return res.status(500).json({ error: true, msg: error.message || "Internal Server Error" });
        }
    }
};
