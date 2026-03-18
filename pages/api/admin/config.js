import db from "../../../components/db";
import lib from "../../../components/lib";

const { DashboardConfig } = db;
const { success, error, midd } = lib;

export default async (req, res) => {
    await midd(req, res);
    if (req.method === "OPTIONS") return res.status(200).end();

    if (req.method === "GET") {
        try {
            const config = await DashboardConfig.findOne({ id: "books_section" });
            return res.json(success({ config }));
        } catch (err) {
            return res.status(500).json({ error: true, msg: err.message });
        }
    }

    if (req.method === "POST") {
        try {
            const { subtitle } = req.body;
            
            const existing = await DashboardConfig.findOne({ id: "books_section" });
            if (existing) {
                await DashboardConfig.update({ _id: existing._id }, { subtitle });
            } else {
                await DashboardConfig.insert({ id: "books_section", subtitle });
            }

            return res.json(success({ message: "Configuración actualizada" }));
        } catch (err) {
            return res.status(500).json({ error: true, msg: err.message });
        }
    }
};
