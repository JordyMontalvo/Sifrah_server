import db from "../../../components/db";
import lib from "../../../components/lib";
import { MongoClient } from "mongodb";

const URL = process.env.DB_URL;
const name = process.env.DB_NAME;

const { Period } = db;
const { error, success, midd, rand } = lib;

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function buildPeriodKey(year, month) {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
}

function buildPeriodLabel(year, month) {
  const mName = MONTHS_ES[month - 1] || `Mes ${month}`;
  return `${mName} ${year}`;
}

function nextMonthYear(year, month) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

async function getLatestOpenPeriod() {
  const open = await Period.find({ status: "open" });
  if (!open || !open.length) return null;
  open.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return open[0];
}

export default async (req, res) => {
  await midd(req, res);

  if (req.method === "GET") {
    try {
      const client = new MongoClient(URL);
      await client.connect();
      const _db = client.db(name);

      const periods = await _db
        .collection("periods")
        .find({})
        .sort({ year: -1, month: -1, createdAt: -1 })
        .toArray();

      client.close();
      return res.json(success({ periods }));
    } catch (e) {
      console.error("Error obteniendo periodos:", e);
      return res.status(500).json(error("Error obteniendo periodos"));
    }
  }

  if (req.method === "POST") {
    const { action, key } = req.body || {};

    if (action === "ensure_open") {
      // Garantiza que exista un periodo abierto. Si no hay, crea uno del mes actual.
      const existingOpen = await getLatestOpenPeriod();
      if (existingOpen) return res.json(success({ period: existingOpen }));

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const newKey = buildPeriodKey(year, month);

      const existing = await Period.findOne({ key: newKey });
      if (existing && existing.status !== "closed") {
        await Period.update({ key: newKey }, { status: "open" });
        const updated = await Period.findOne({ key: newKey });
        return res.json(success({ period: updated }));
      }

      const period = {
        id: rand(),
        key: newKey,
        year,
        month,
        label: buildPeriodLabel(year, month),
        status: "open",
        createdAt: now,
        closedAt: null,
      };
      await Period.insert(period);
      return res.json(success({ period }));
    }

    if (action === "create") {
      // Crear un periodo manualmente con fechas personalizadas
      const { year, month, createdAt, closedAt } = req.body;
      
      if (!year || !month) {
        return res.json(error("Faltan año y mes del periodo"));
      }
      
      const key = buildPeriodKey(year, month);
      
      // Verificar si ya existe un periodo con esa key
      const existing = await Period.findOne({ key });
      if (existing) {
        return res.json(error(`Ya existe un periodo con la key ${key} (${buildPeriodLabel(year, month)})`));
      }
      
      // Crear el periodo
      const period = {
        id: rand(),
        key,
        year: parseInt(year),
        month: parseInt(month),
        label: buildPeriodLabel(year, month),
        status: closedAt ? "closed" : "open",
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        closedAt: closedAt ? new Date(closedAt) : null,
      };
      
      await Period.insert(period);
      const created = await Period.findOne({ key });
      return res.json(success({ period: created }));
    }

    if (action === "close") {
      if (!key) return res.json(error("Falta el key del periodo"));

      const period = await Period.findOne({ key });
      if (!period) return res.json(error("Periodo no existe"));
      if (period.status === "closed") {
        return res.json(success({ period, nextPeriod: null }));
      }

      // Cerrar el periodo con la fecha/hora actual
      // IMPORTANTE: El cierre puede hacerse en cualquier fecha, no necesariamente
      // al final del mes. Por ejemplo:
      // - Periodo "Enero 2025" iniciado el 2 de enero
      // - Puede cerrarse el 3 de febrero
      // - Todas las compras del 2 de enero al 3 de febrero pertenecen a "Enero 2025"
      const now = new Date();
      await Period.update({ key }, { status: "closed", closedAt: now });
      const closedPeriod = await Period.findOne({ key });

      // Crear siguiente periodo automáticamente (mes–año siguiente)
      // Ejemplo: Si se cierra "Enero 2025", se crea "Febrero 2025"
      const { year: ny, month: nm } = nextMonthYear(period.year, period.month);
      const nextKey = buildPeriodKey(ny, nm);

      // Si ya existe un periodo abierto, no crear otro (no debería pasar, pero por seguridad)
      const anyOpen = await getLatestOpenPeriod();
      if (anyOpen) return res.json(success({ period: closedPeriod, nextPeriod: anyOpen }));

      // Verificar si ya existe un periodo con la key del mes siguiente
      const existingNext = await Period.findOne({ key: nextKey });
      if (existingNext) {
        // Si existe pero estaba cerrado, lo reabrimos como "open"
        if (existingNext.status === "closed") {
          await Period.update({ key: nextKey }, { status: "open", createdAt: now, closedAt: null });
        }
        const reopened = await Period.findOne({ key: nextKey });
        return res.json(success({ period: closedPeriod, nextPeriod: reopened }));
      }

      // Crear nuevo periodo del mes siguiente
      const nextPeriod = {
        id: rand(),
        key: nextKey,
        year: ny,
        month: nm,
        label: buildPeriodLabel(ny, nm),
        status: "open",
        createdAt: now, // Fecha de creación = fecha de cierre del periodo anterior
        closedAt: null,
      };
      await Period.insert(nextPeriod);
      return res.json(success({ period: closedPeriod, nextPeriod }));
    }

    return res.json(error("Acción inválida"));
  }

  return res.json(error("Método inválido"));
};


