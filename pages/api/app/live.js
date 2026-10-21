import axios from "axios";
import db from "../../../components/db";
import lib from "../../../components/lib";

const { Broadcast } = db;
const { success, midd } = lib;

// Estado de "Audio en vivo" para la app/web del socio.
//
// Fuente de verdad del estado: la coleccion `broadcasts` en SIFRAH (status).
// "Programado != activo": solo un encuentro con status == "live" esta en el aire.
//
// Senal real opcional (AzuraCast): si el encuentro en vivo trae `station` (o hay
// AZURACAST_STATION en el entorno) y hay AZURACAST_BASE_URL configurado, se
// consulta la API now-playing para confirmar que el DJ esta realmente emitiendo
// y cuantos oyentes hay. Si no se puede consultar, NO se asume "fuera del aire":
// se devuelve azuracast_reachable=false para que el front muestre "Conectando".
async function fetchAzuracastNowPlaying(station) {
    const base = (process.env.AZURACAST_BASE_URL || "").replace(/\/$/, "");
    const shortcode = station || process.env.AZURACAST_STATION || "";
    if (!base || !shortcode) {
        return { configured: false, reachable: false, onair: null, listeners: null, streamer: null };
    }
    try {
        const { data } = await axios.get(`${base}/api/nowplaying/${shortcode}`, { timeout: 4000 });
        const np = Array.isArray(data) ? data[0] : data;
        const liveInfo = (np && np.live) || {};
        return {
            configured: true,
            reachable: true,
            onair: !!liveInfo.is_live,
            listeners: np && np.listeners ? (np.listeners.current ?? null) : null,
            streamer: liveInfo.streamer_name || null,
        };
    } catch (err) {
        console.error("[live] AzuraCast now-playing no disponible:", err.message);
        return { configured: true, reachable: false, onair: null, listeners: null, streamer: null };
    }
}

export default async (req, res) => {
    await midd(req, res);
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).end();

    try {
        const now = new Date();

        // Encuentro en vivo (a lo mas uno). Si hubiera varios marcados, el mas
        // reciente en iniciar.
        const liveList = await Broadcast.find(
            { status: "live" },
            { sort: { live_started_at: -1 }, limit: 1 }
        );
        let live = liveList.length ? liveList[0] : null;

        // Proximas transmisiones: programadas, no canceladas ni finalizadas,
        // ordenadas por fecha ascendente. Las sin fecha se incluyen al final
        // (Mongo ordena los null primero, por eso se separan).
        const scheduled = await Broadcast.find(
            { status: "scheduled" },
            { sort: { scheduled_start: 1 } }
        );
        const dated = scheduled.filter((b) => b.scheduled_start && new Date(b.scheduled_start) >= now);
        const undated = scheduled.filter((b) => !b.scheduled_start);
        const upcoming = [...dated, ...undated].slice(0, 10);

        // Senal real de AzuraCast (si aplica) para el encuentro en vivo.
        let azuracast = { configured: false, reachable: false, onair: null, listeners: null, streamer: null };
        if (live) {
            azuracast = await fetchAzuracastNowPlaying(live.station);
            live = {
                ...live,
                stream_url: live.stream_url || process.env.AZURACAST_STREAM_URL || "",
            };
        }

        return res.json(
            success({
                live,
                upcoming,
                azuracast,
                server_time: now.toISOString(),
            })
        );
    } catch (err) {
        console.error("Error in GET /app/live:", err);
        return res.status(500).json({ error: true, msg: err.message || "Internal Server Error" });
    }
};
