import db from "../../../components/db";
import lib from "../../../components/lib";

const { Book } = db;
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
            let books = await Book.find({});
            return res.json(success({ books }));
        } catch (error) {
            console.error("Error in GET /admin/books:", error);
            return res.status(500).json({ error: true, msg: error.message || "Internal Server Error" });
        }
    }

    if (req.method == "POST") {
        try {
            const { action } = req.body;

            if (action == "edit") {
                const { id } = req.body;
                if (!id) return res.json({ error: true, msg: "ID is required" });

                const { title, author, category, pages, url, pdfUrl, image, description, active, rating } = req.body.data || {};

                await Book.update(
                    { id },
                    {
                        title,
                        author,
                        category,
                        pages,
                        url,
                        pdfUrl,
                        image,
                        description,
                        rating: Number(rating) || 5,
                        active: active !== undefined ? active : true,
                        updated_at: new Date(),
                    }
                );
            } else if (action == "add") {
                const { title, author, category, pages, url, pdfUrl, image, description, active, rating } = req.body.data || {};

                if (!title || !url) {
                    return res.json({ error: true, msg: "Title and URL are required" });
                }

                await Book.insert({
                    id: rand(),
                    title,
                    author: author || "Equipo SIFRAH",
                    category: category || "General",
                    pages: pages || "100",
                    url,
                    pdfUrl: pdfUrl || "",
                    image: image || "",
                    description: description || "",
                    rating: Number(rating) || 5,
                    active: active !== undefined ? active : true,
                    created_at: new Date(),
                    updated_at: new Date(),
                });
            } else if (action == "delete") {
                const { id } = req.body;
                if (!id) return res.json({ error: true, msg: "ID is required" });
                await Book.delete({ id });
            }

            return res.json(success({}));
        } catch (error) {
            console.error("Error in POST /admin/books:", error);
            return res.status(500).json({ error: true, msg: error.message || "Internal Server Error" });
        }
    }

    if (req.method == "DELETE") {
        try {
            const { id } = req.body;
            if (!id) return res.json({ error: true, msg: "ID is required" });
            await Book.delete({ id });
            return res.json(success({ message: "Book deleted successfully" }));
        } catch (error) {
            console.error("Error in DELETE /admin/books:", error);
            return res.status(500).json({ error: true, msg: error.message || "Internal Server Error" });
        }
    }
};
