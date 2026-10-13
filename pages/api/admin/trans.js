import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

const { Transaction, User, Period } = db;
const { midd, success, error, rand } = lib;

// Un identificador tiene que llegar como texto. Si se admitiera un objeto, se
// podria enviar un operador de consulta en su lugar y el filtro encajaria con
// un movimiento cualquiera en vez de con el elegido.
function exigirIdentificador(valor) {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio || null;
}

// El importe tiene que ser un numero de verdad. Si entra un texto o un objeto,
// las sumas de saldo lo tratan como cero y la cuenta del socio se descuadra
// sin que salte ningun aviso.
function validarImporte(valor) {
  const numero = typeof valor === "string" ? Number(valor.trim()) : valor;
  if (typeof numero !== "number" || !Number.isFinite(numero)) return null;
  return numero;
}

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function buildPeriodKey(year, month) {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
}

function buildPeriodLabel(year, month) {
  const mName = MONTHS_ES[month - 1] || `Mes ${month}`;
  return `${mName} ${year}`;
}

async function getOrCreateOpenPeriod(now = new Date()) {
  const openPeriods = await Period.find({ status: "open" });
  if (openPeriods && openPeriods.length) {
    openPeriods.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return openPeriods[0];
  }
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const key = buildPeriodKey(year, month);
  const existing = await Period.findOne({ key });
  if (existing && existing.status !== "closed") return existing;
  const period = {
    id: rand(),
    key,
    year,
    month,
    label: buildPeriodLabel(year, month),
    status: "open",
    createdAt: now,
    closedAt: null,
  };
  await Period.insert(period);
  return period;
}

export default async (req, res) => {
  await midd(req, res);
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    const { filter, page = 1, limit = 20, search, timeRange } = req.query;
    console.log("Received request with page:", page, "and limit:", limit);
    console.log("Full query params:", req.query);
    const q = { all: {}, pending: { status: "pending" } };
    if (!(filter in q)) return res.json(lib.error("invalid filter"));

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));

    try {
      // Misma capa de conexión que login / resto del admin (evita URI distinta a la de MongoClient manual).
      let transactions = await Transaction.find(q[filter]);
      console.log("Found transactions:", transactions.length);

      const userIds = [
        ...new Set(
          transactions
            .flatMap((t) => [t.user_id, t._user_id, t.from_user_id])
            .filter((id) => id != null && id !== "")
        ),
      ];
      const users =
        userIds.length > 0
          ? await User.find({ id: { $in: userIds } })
          : [];
      console.log("Found users:", users.length);
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Enriquecer transacciones con información de usuarios
      transactions = transactions.map((t) => {
        const originId = t._user_id || t.from_user_id;
        const originUser = originId ? (userMap.get(originId) || {}) : {};
        const originName =
          t.affiliate_name ||
          `${originUser.name || ""} ${originUser.lastName || ""}`.trim() ||
          originUser.name ||
          "";
        const originDni = t.affiliate_dni || originUser.dni || null;

        return {
          ...t,
          user_info: userMap.get(t.user_id) || {},
          _user_info: {
            ...originUser,
            name: originName,
            dni: originDni,
          },
        };
      });

      // Aplicar búsqueda si existe
      if (search) {
        const searchLower = search.toLowerCase();
        transactions = transactions.filter((t) => {
          const name = (t.name || "").toLowerCase();
          const id = (t.id || "").toLowerCase();
          const userId = (t.user_id || "").toLowerCase();
          const affiliationId = (t.affiliation_id || "").toLowerCase();

          // Buscar en nombres de usuarios
          const userName = (
            (t.user_info.name || "") +
            " " +
            (t.user_info.lastName || "")
          ).toLowerCase();
          const _userName = (
            (t._user_info.name || "") +
            " " +
            (t._user_info.lastName || "")
          ).toLowerCase();

          return (
            name.includes(searchLower) ||
            id.includes(searchLower) ||
            userId.includes(searchLower) ||
            affiliationId.includes(searchLower) ||
            userName.includes(searchLower) ||
            _userName.includes(searchLower)
          );
        });
      }

      // Aplicar filtro de tiempo si existe
      if (timeRange) {
        const now = new Date();
        let startDate;
        switch (timeRange) {
          case "week":
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case "month":
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
          case "year":
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
        }
        if (startDate) {
          transactions = transactions.filter(
            (t) => new Date(t.date) >= startDate
          );
        }
      }

      // Ordenar por fecha más reciente
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Calcular total de items y páginas
      const totalItems = transactions.length;
      const totalPages = Math.ceil(totalItems / limitNum);

      // Obtener items de la página actual
      const skip = (pageNum - 1) * limitNum;
      const paginatedTransactions = transactions.slice(skip, skip + limitNum);

      return res.json(
        success({
          transactions: paginatedTransactions,
          totalItems,
          totalPages,
          currentPage: pageNum,
        })
      );
    } catch (error) {
      console.error("Database error:", error);
      return res.status(500).json(lib.error("Database error"));
    }
  }

  if (req.method == "POST") {
    const { action } = req.body;

    if (action == "edit") {
      const id = exigirIdentificador(req.body.id);
      if (!id) return res.json(error("id invalido"));
      // Un campo ausente o vacio significa 'no lo cambies', como antes. Solo se
      // comprueba lo que de verdad viene con un valor.
      const datos = req.body.data || {};
      const _type = datos._type == null ? undefined : datos._type;
      const _value = datos._value == null ? undefined : datos._value;
      const _name = datos._name == null ? undefined : datos._name;

      // El formulario del panel solo deja cambiar el tipo, el importe y el
      // concepto. Antes se aceptaban ademas el socio dueno del movimiento, su
      // estado y la afiliacion ligada, campos que ninguna pantalla envia: con
      // ellos se podia reasignar un apunte de dinero a otra cuenta.
      const updateData = {};

      if (_type !== undefined) {
        if (_type !== "in" && _type !== "out")
          return res.json(error("tipo invalido"));
        updateData.type = _type;
      }

      if (_value !== undefined) {
        const importe = validarImporte(_value);
        if (importe === null) return res.json(error("importe invalido"));
        updateData.value = importe;
      }

      if (_name !== undefined) {
        if (typeof _name !== "string" || !_name.trim())
          return res.json(error("concepto invalido"));
        updateData.name = _name.trim();
      }

      // Actualizar solo si hay campos para actualizar
      if (Object.keys(updateData).length > 0) {
        await Transaction.update({ id }, updateData);
      }
    }

    if (action == "add") {
      const { user_id, type, value, name, affiliation_id, virtual, status } =
        req.body.data || {};

      const destinatario = exigirIdentificador(user_id);
      if (!destinatario) return res.json(error("socio invalido"));
      if (type !== "in" && type !== "out")
        return res.json(error("tipo invalido"));
      const importe = validarImporte(value);
      if (importe === null) return res.json(error("importe invalido"));
      if (typeof name !== "string" || !name.trim())
        return res.json(error("concepto invalido"));

      const period = await getOrCreateOpenPeriod(new Date());

      await Transaction.insert({
        id: rand(),
        date: new Date(),
        user_id: destinatario,
        type,
        value: importe,
        name: name.trim(),
        affiliation_id: exigirIdentificador(affiliation_id) || null,
        virtual: !!virtual,
        status,
        period_key: period.key,
        period_label: period.label,
      });
    }

    if (action == "delete") {
      const id = exigirIdentificador(req.body.id);
      if (!id) return res.json(error("id invalido"));
      await Transaction.delete({ id });
    }

    // response
    return res.json(success({}));
  }
};
