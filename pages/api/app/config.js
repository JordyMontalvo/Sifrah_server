import db from "../../../components/db";
import lib from "../../../components/lib";

const { DashboardConfig } = db;
const { success, midd } = lib;
const { applyCORS } = require("../../../middleware/middleware-cors");

export default async (req, res) => {
    applyCORS(req, res);
    if (req.method === "OPTIONS") return res.status(200).end();

    await midd(req, res);

    if (req.method === "GET") {
        try {
            const config = await DashboardConfig.findOne({ id: "books_section" });
            return res.json(success({ 
                subtitle: config ? config.subtitle : "Lee y aprende sin límites" 
            }));
        } catch (error) {
            return res.status(500).json({ error: true, msg: error.message });
        }
    }
};
