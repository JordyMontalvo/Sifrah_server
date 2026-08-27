import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

const { Book } = db;
const { midd, success, rand } = lib;

export default async (req, res) => {
    await midd(req, res);
    if (req.method === "OPTIONS") return res.status(200).end();

    const auth = await requireAdmin(req, res);
    if (!auth) return;

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

                // Aseguramos que url y pdfUrl siempre tengan valor si alguno de los dos está presente
                const resolvedUrl = url || pdfUrl || "";
                const resolvedPdfUrl = pdfUrl || url || "";

                await Book.update(
                    { id },
                    {
                        title,
                        author,
                        category,
                        pages,
                        url: resolvedUrl,
                        pdfUrl: resolvedPdfUrl,
                        image,
                        description,
                        rating: Number(rating) || 5,
                        active: active !== undefined ? active : true,
                        updated_at: new Date(),
                    }
                );
            } else if (action == "add") {
                const { title, author, category, pages, url, pdfUrl, image, description, active, rating } = req.body.data || {};

                // Aceptar pdfUrl como fuente principal del PDF; url es el fallback (o viceversa)
                const resolvedUrl = url || pdfUrl || "";
                const resolvedPdfUrl = pdfUrl || url || "";

                if (!title || !resolvedUrl) {
                    return res.json({ error: true, msg: "El título y al menos una URL del PDF son requeridos" });
                }

                await Book.insert({
                    id: rand(),
                    title,
                    author: author || "Equipo SIFRAH",
                    category: category || "General",
                    pages: pages || "100",
                    url: resolvedUrl,
                    pdfUrl: resolvedPdfUrl,
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
