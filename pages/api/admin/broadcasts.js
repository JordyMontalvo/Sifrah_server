import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

const { Broadcast } = db;
const { success, midd, rand } = lib;

// Estados validos de un encuentro en vivo.
// scheduled: programado (aun no transmite). live: en el aire ahora.
// ended: finalizado. cancelled: cancelado (no aparece en "proximas").
const STATUSES = ["scheduled", "live", "ended", "cancelled"];
const DEFAULT_TZ = "America/Lima";

// Admin de "Audio en vivo" (encuentros/transmisiones). La BIBLIOTECA de audios
// grabados sigue en /admin/audios (coleccion `audios`); esto es la coleccion
// separada `broadcasts`. El estado "en vivo" es la fuente de verdad en SIFRAH:
// publicar o programar un encuentro NO significa iniciar la transmision.
export default async (req, res) => {
    await midd(req, res);
    if (req.method === "OPTIONS") return res.status(200).end();

    const auth = await requireAdmin(req, res);
    if (!auth) return;

    if (req.method == "GET") {
        try {
            // Mas recientes/proximos primero por fecha programada.
            const broadcasts = await Broadcast.find({}, { sort: { scheduled_start: -1 } });
            return res.json(success({ broadcasts }));
        } catch (err) {
            console.error("Error in GET /admin/broadcasts:", err);
            return res.status(500).json({ error: true, msg: err.message || "Internal Server Error" });
        }
    }

    if (req.method == "POST") {
        try {
            const { action } = req.body;

            if (action == "add") {
                const d = req.body.data || {};
                if (!d.title) return res.json({ error: true, msg: "Title is required" });

                await Broadcast.insert({
                    id: rand(),
                    title: d.title,
                    author: d.author || "Equipo SIFRAH",
                    description: d.description || "",
                    image: d.image || "",
                    scheduled_start: d.scheduled_start || null,
                    scheduled_end: d.scheduled_end || null,
                    timezone: d.timezone || DEFAULT_TZ,
                    status: STATUSES.includes(d.status) ? d.status : "scheduled",
                    stream_url: d.stream_url || "",
                    station: d.station || "",
                    created_at: new Date(),
                    updated_at: new Date(),
                });
                return res.json(success({}));
            }

            if (action == "edit") {
                const { id } = req.body;
                if (!id) return res.json({ error: true, msg: "ID is required" });
                const d = req.body.data || {};

                await Broadcast.update(
                    { id },
                    {
                        title: d.title,
                        author: d.author,
                        description: d.description,
                        image: d.image,
                        scheduled_start: d.scheduled_start,
                        scheduled_end: d.scheduled_end,
                        timezone: d.timezone,
                        status: STATUSES.includes(d.status) ? d.status : undefined,
                        stream_url: d.stream_url,
                        station: d.station,
                        updated_at: new Date(),
                    }
                );
                return res.json(success({}));
            }

            // Cambio de estado explicito (boton "Poner en vivo" / "Finalizar").
            // Separado de la administracion de contenido a proposito.
            if (action == "setStatus") {
                const { id, status } = req.body;
                if (!id) return res.json({ error: true, msg: "ID is required" });
                if (!STATUSES.includes(status)) {
                    return res.json({ error: true, msg: "Invalid status" });
                }

                const values = { status, updated_at: new Date() };
                if (status === "live") values.live_started_at = new Date();
                if (status === "ended") values.live_ended_at = new Date();

                await Broadcast.update({ id }, values);
                return res.json(success({}));
            }

            if (action == "delete") {
                const { id } = req.body;
                if (!id) return res.json({ error: true, msg: "ID is required" });
                await Broadcast.delete({ id });
                return res.json(success({}));
            }

            return res.json({ error: true, msg: "Unknown action" });
        } catch (err) {
            console.error("Error in POST /admin/broadcasts:", err);
            return res.status(500).json({ error: true, msg: err.message || "Internal Server Error" });
        }
    }

    if (req.method == "DELETE") {
        try {
            const { id } = req.body;
            if (!id) return res.json({ error: true, msg: "ID is required" });
            await Broadcast.delete({ id });
            return res.json(success({ message: "Broadcast deleted successfully" }));
        } catch (err) {
            console.error("Error in DELETE /admin/broadcasts:", err);
            return res.status(500).json({ error: true, msg: err.message || "Internal Server Error" });
        }
    }

    return res.status(405).end();
};
