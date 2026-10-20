import bcrypt from "bcrypt";
import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

const { User, Transaction, Closed, Tree, Session, AuditLog } = db;
const { error, success, midd, model, rand } = lib;

// valid filters
// const q = { all: {}, affiliated: { affiliated: true }, activated: { activated: true } }

// models
const U = [
  "id",
  "date",
  "name",
  "lastName",
  "dni",
  "email",
  "phone",
  "department",
  "affiliated",
  "activated",
  "_activated",
  "token",
  "points",
  "balance",
  "virtualbalance",
  "sifrahbalance",
  "country",
  "rank",
  "rank_history",
  "birthdate",
  "address",
  "city",
  "plan",
  "affiliation_points",
  "status",        // blocked | eliminated | active | null
  "statusReason",
  "blocked_at",
  "eliminated_at",
];

/** Campos del patrocinador expuestos al admin (evita filtrar `parent` con `model(user, U)`). */
const PARENT_PUBLIC = ["id", "name", "lastName", "dni"];

/** Incluye variantes número/string para `$in` en MongoDB (IDs inconsistentes entre colecciones). */
function expandIdsForIn(ids) {
  const out = new Set();
  for (const id of ids) {
    if (id == null || id === "") continue;
    out.add(id);
    const n = Number(id);
    if (!Number.isNaN(n)) out.add(n);
  }
  return [...out];
}

function periodFromDate(dateValue) {
  const d = new Date(dateValue || new Date());
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Identifica un registro de rank_history para borrar (primer coincidencia). */
function matchesRankHistoryEntry(entry, { rank, date, period }) {
  if (!entry || String(entry.rank) !== String(rank)) return false;
  const eTime = new Date(entry.date).getTime();
  const tTime = new Date(date).getTime();
  if (isNaN(eTime) || isNaN(tTime)) return false;
  if (eTime !== tTime) return false;
  const ePeriod =
    entry.period != null && String(entry.period).trim() !== ""
      ? String(entry.period).trim()
      : periodFromDate(entry.date);
  const tPeriod =
    period != null && String(period).trim() !== ""
      ? String(period).trim()
      : periodFromDate(date);
  return ePeriod === tPeriod;
}

const handler = async (req, res, auth) => {
  if (req.method == "GET") {
    const { filter, page = 1, limit = 20, search, showAvailable, showVirtualBalance } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const q = {
      all: {},
      affiliated: { affiliated: true },
      activated: { activated: true },
      blocked: { status: 'blocked' },
      eliminated: { status: 'eliminated' },
    };

    // validate filter
    if (!(filter in q)) return res.json(error("invalid filter"));

    // ── Helper: normalizar texto para búsqueda ───────────────────────────────
    const normalize = (str) =>
      (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const searchNormalized = normalize(search);

    // ═══════════════════════════════════════════════════════════════════════════
    // CASO RÁPIDO: sin filtros de saldo
    // La mayoría de requests (lista general, filtros por rol) caen aquí.
    // Ordenar, paginar y contar 100% en MongoDB.
    // ═══════════════════════════════════════════════════════════════════════════
    if (showAvailable !== "true" && showVirtualBalance !== "true") {
      // Construir query de búsqueda en DB si viene `search`
      let searchQuery = {};
      if (search && search.trim()) {
        const regex = { $regex: search.trim(), $options: "i" };
        searchQuery = {
          $or: [
            { name: regex }, { lastName: regex }, { dni: regex },
            { country: regex }, { phone: regex }, { city: regex },
          ],
        };
      }
      const finalQuery = { ...q[filter], ...searchQuery };
      const skip = (pageNum - 1) * limitNum;

      // Query + count en paralelo
      const [allUsersPage, totalUsers] = await Promise.all([
        User.find(finalQuery, { sort: { date: -1 }, skip, limit: limitNum }),
        User.count(finalQuery),
      ]);

      // Saldos: aggregation en MongoDB solo para los IDs de la página
      const pageIds = allUsersPage.map((u) => String(u.id));
      const [balanceAgg, virtualAgg] = await Promise.all([
        Transaction._getCollection().then((col) =>
          col.aggregate([
            { $match: { user_id: { $in: pageIds }, virtual: { $in: [null, false] } } },
            {
              $group: {
                _id: "$user_id",
                ins: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "in"] }, { $ne: ["$wallet_tipo", "BONO_AHORRO"] }] }, { $toDouble: "$value" }, 0] } },
                outs: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "out"] }, { $ne: ["$wallet_tipo", "BONO_AHORRO"] }] }, { $toDouble: "$value" }, 0] } },
                sifIns: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "in"] }, { $eq: ["$wallet_tipo", "BONO_AHORRO"] }] }, { $toDouble: "$value" }, 0] } },
                sifOuts: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "out"] }, { $eq: ["$wallet_tipo", "BONO_AHORRO"] }] }, { $toDouble: "$value" }, 0] } },
              },
            },
          ]).toArray()
        ),
        Transaction._getCollection().then((col) =>
          col.aggregate([
            { $match: { user_id: { $in: pageIds }, virtual: true } },
            {
              $group: {
                _id: "$user_id",
                vIns: { $sum: { $cond: [{ $eq: ["$type", "in"] }, { $toDouble: "$value" }, 0] } },
                vOuts: { $sum: { $cond: [{ $eq: ["$type", "out"] }, { $toDouble: "$value" }, 0] } },
              },
            },
          ]).toArray()
        ),
      ]);

      const balMap = new Map(balanceAgg.map((r) => [r._id, r]));
      const virMap = new Map(virtualAgg.map((r) => [r._id, r]));

      // Resolución de patrocinadores (igual que antes, solo sobre la página)
      const rawParentIds = allUsersPage
        .filter((u) => u.parentId != null && u.parentId !== "")
        .map((u) => u.parentId);
      const parentIds = expandIdsForIn([...new Set(rawParentIds)]);
      const parents = parentIds.length > 0 ? await User.find({ id: { $in: parentIds } }) : [];

      let users = allUsersPage.map((user) => {
        const b = balMap.get(String(user.id)) || {};
        const vb = virMap.get(String(user.id)) || {};
        user.balance = (b.ins || 0) - (b.outs || 0);
        user.sifrahbalance = (b.sifIns || 0) - (b.sifOuts || 0);
        user.virtualbalance = (vb.vIns || 0) - (vb.vOuts || 0);
        if (user.parentId) {
          const p = parents.find((el) => el.id == user.parentId);
          if (p) user.parent = p;
        }
        const u = model(user, U);
        u.virtualbalance = Number(user.virtualbalance ?? 0);
        u.sifrahbalance = Number(user.sifrahbalance ?? 0);
        if (user.parent) u.parent = model(user.parent, PARENT_PUBLIC);
        return { ...u };
      });

      // totalBalance / totalVirtualBalance: suma de la página
      const totalBalance = [...balMap.values()].reduce((s, r) => s + (r.ins || 0) - (r.outs || 0), 0);
      const totalVirtualBalance = [...virMap.values()].reduce((s, r) => s + (r.vIns || 0) - (r.vOuts || 0), 0);

      return res.json(success({
        users,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limitNum),
        currentPage: pageNum,
        totalBalance,
        totalVirtualBalance,
      }));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CASO CON FILTRO DE SALDO (showAvailable / showVirtualBalance)
    // Requiere evaluar balance de todos los usuarios antes de paginar.
    // ═══════════════════════════════════════════════════════════════════════════
    let allUsers = await User.find(q[filter]);

    // Búsqueda textual en JS (sobre el set ya reducido por q[filter])
    if (search && search.trim()) {
      allUsers = allUsers.filter((user) =>
        normalize(user.name).includes(searchNormalized) ||
        normalize(user.lastName).includes(searchNormalized) ||
        normalize(user.dni).includes(searchNormalized) ||
        normalize(user.country).includes(searchNormalized) ||
        normalize(user.phone).includes(searchNormalized) ||
        normalize(user.city).includes(searchNormalized)
      );
    }

    const allUserIds = allUsers.map((u) => String(u.id));

    // ── Filtro showAvailable: usar $group pipeline para pre-calcular en DB ────
    if (showAvailable === "true") {
      const col = await Transaction._getCollection();
      const agg = await col.aggregate([
        {
          $match: {
            user_id: { $in: allUserIds },
            virtual: { $in: [null, false] },
            wallet_tipo: { $ne: "BONO_AHORRO" },
          },
        },
        {
          $group: {
            _id: "$user_id",
            ins: { $sum: { $cond: [{ $eq: ["$type", "in"] }, { $toDouble: "$value" }, 0] } },
            outs: { $sum: { $cond: [{ $eq: ["$type", "out"] }, { $toDouble: "$value" }, 0] } },
          },
        },
        { $match: { $expr: { $gt: [{ $subtract: ["$ins", "$outs"] }, 0] } } },
      ]).toArray();
      const eligibleIds = new Set(agg.map((r) => r._id));
      allUsers = allUsers.filter((u) => eligibleIds.has(String(u.id)));
    }

    // ── Filtro showVirtualBalance: lógica de compensación "closed reset" ──────
    // Mantiene exactamente la misma lógica de negocio que antes.
    // Mejora: los queries de Transaction se filtran por user_id para no cargar
    // toda la colección de transacciones en memoria.
    if (showVirtualBalance === "true" || showVirtualBalance === true) {
      const [allClosedResetTransactions, allVirtualTransactionsExceptReset] = await Promise.all([
        Transaction.find({ name: "closed reset", virtual: true, user_id: { $in: allUserIds } }),
        Transaction.find({ virtual: true, name: { $ne: "closed reset" }, user_id: { $in: allUserIds } }),
      ]);

      const closedResetByUser = {};
      for (const t of allClosedResetTransactions) {
        if (!closedResetByUser[t.user_id]) closedResetByUser[t.user_id] = [];
        closedResetByUser[t.user_id].push(t);
      }
      for (const uid in closedResetByUser) {
        closedResetByUser[uid].sort((a, b) => new Date(a.date) - new Date(b.date));
      }

      const virtualByUser = {};
      for (const t of allVirtualTransactionsExceptReset) {
        if (!virtualByUser[t.user_id]) virtualByUser[t.user_id] = [];
        virtualByUser[t.user_id].push(t);
      }
      for (const uid in virtualByUser) {
        virtualByUser[uid].sort((a, b) => new Date(a.date) - new Date(b.date));
      }

      let conSaldoNoDisponible = 0;
      const beforeFilterCount = allUsers.length;

      allUsers = allUsers.filter((user) => {
        const userClosedResets = closedResetByUser[user.id] || [];
        const userVirtualTransactions = virtualByUser[user.id] || [];
        const compensatedTransactionIds = new Set();

        for (const resetTransaction of userClosedResets) {
          const transactionsAvailableForReset = userVirtualTransactions.filter((t) => {
            const transactionDate = new Date(t.date);
            const resetDate = new Date(resetTransaction.date);
            return transactionDate <= resetDate && !compensatedTransactionIds.has(t.id);
          });

          let remainingToCompensate = Math.abs(resetTransaction.value);
          for (const transaction of transactionsAvailableForReset) {
            if (remainingToCompensate <= 0) break;
            if (transaction.type === "in") {
              compensatedTransactionIds.add(transaction.id);
              remainingToCompensate = Math.max(0, remainingToCompensate - transaction.value);
            }
          }
        }

        const validVirtualTransactions = userVirtualTransactions.filter(
          (t) => !compensatedTransactionIds.has(t.id)
        );
        const virtualIns = validVirtualTransactions
          .filter((i) => i.type === "in")
          .reduce((a, b) => a + parseFloat(b.value || 0), 0);
        const virtualOuts = validVirtualTransactions
          .filter((i) => i.type === "out")
          .reduce((a, b) => a + parseFloat(b.value || 0), 0);
        const hasVirtualBalance = virtualIns - virtualOuts > 0;

        if (hasVirtualBalance) conSaldoNoDisponible++;
        return hasVirtualBalance;
      });

      console.log(`[users] filtro saldo no disponible: ${conSaldoNoDisponible} de ${beforeFilterCount}`);
    }

    // Ordenar y paginar en JS (necesario cuando el set fue filtrado por saldo)
    allUsers.sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalUsers = allUsers.length;
    const skip = (pageNum - 1) * limitNum;
    let users = allUsers.slice(skip, skip + limitNum);

    // Resolución de patrocinadores (solo sobre la página)
    const rawParentIds = users
      .filter((i) => i.parentId != null && i.parentId !== "")
      .map((i) => i.parentId);
    const parentIds = expandIdsForIn([...new Set(rawParentIds)]);
    const parents = parentIds.length > 0 ? await User.find({ id: { $in: parentIds } }) : [];

    users = users.map((user) => {
      if (user.parentId) {
        const i = parents.findIndex((el) => el.id == user.parentId);
        if (i !== -1) user.parent = parents[i];
      }
      return user;
    });

    // Calcular saldos para la página usando aggregation (solo IDs de la página)
    const pageIds = users.map((u) => String(u.id));
    const [balanceAgg, virtualAgg] = await Promise.all([
      Transaction._getCollection().then((col) =>
        col.aggregate([
          { $match: { user_id: { $in: pageIds }, virtual: { $in: [null, false] } } },
          {
            $group: {
              _id: "$user_id",
              ins: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "in"] }, { $ne: ["$wallet_tipo", "BONO_AHORRO"] }] }, { $toDouble: "$value" }, 0] } },
              outs: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "out"] }, { $ne: ["$wallet_tipo", "BONO_AHORRO"] }] }, { $toDouble: "$value" }, 0] } },
              sifIns: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "in"] }, { $eq: ["$wallet_tipo", "BONO_AHORRO"] }] }, { $toDouble: "$value" }, 0] } },
              sifOuts: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "out"] }, { $eq: ["$wallet_tipo", "BONO_AHORRO"] }] }, { $toDouble: "$value" }, 0] } },
            },
          },
        ]).toArray()
      ),
      Transaction._getCollection().then((col) =>
        col.aggregate([
          { $match: { user_id: { $in: pageIds }, virtual: true } },
          {
            $group: {
              _id: "$user_id",
              vIns: { $sum: { $cond: [{ $eq: ["$type", "in"] }, { $toDouble: "$value" }, 0] } },
              vOuts: { $sum: { $cond: [{ $eq: ["$type", "out"] }, { $toDouble: "$value" }, 0] } },
            },
          },
        ]).toArray()
      ),
    ]);

    const balMap = new Map(balanceAgg.map((r) => [r._id, r]));
    const virMap = new Map(virtualAgg.map((r) => [r._id, r]));

    // Totales globales de todos los usuarios filtrados (suma del set completo)
    const allPageAllIds = allUsers.map((u) => String(u.id));
    const [totalBalAgg, totalVirAgg] = await Promise.all([
      Transaction._getCollection().then((col) =>
        col.aggregate([
          { $match: { user_id: { $in: allPageAllIds }, virtual: { $in: [null, false] }, wallet_tipo: { $ne: "BONO_AHORRO" } } },
          { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ["$type", "in"] }, { $toDouble: "$value" }, { $multiply: [{ $toDouble: "$value" }, -1] }] } } } },
        ]).toArray()
      ),
      Transaction._getCollection().then((col) =>
        col.aggregate([
          { $match: { user_id: { $in: allPageAllIds }, virtual: true } },
          { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ["$type", "in"] }, { $toDouble: "$value" }, { $multiply: [{ $toDouble: "$value" }, -1] }] } } } },
        ]).toArray()
      ),
    ]);

    const totalBalance = totalBalAgg[0]?.total ?? 0;
    const totalVirtualBalance = totalVirAgg[0]?.total ?? 0;

    // Aplicar saldos individuales a usuarios de la página
    users = users.map((user) => {
      const b = balMap.get(String(user.id)) || {};
      const vb = virMap.get(String(user.id)) || {};
      user.balance = (b.ins || 0) - (b.outs || 0);
      user.sifrahbalance = (b.sifIns || 0) - (b.sifOuts || 0);
      user.virtualbalance = (vb.vIns || 0) - (vb.vOuts || 0);
      return user;
    });

    // Serializar al modelo público
    users = users.map((user) => {
      const u = model(user, U);
      u.virtualbalance = user.virtualbalance != null ? Number(user.virtualbalance) : 0;
      u.sifrahbalance = user.sifrahbalance != null ? Number(user.sifrahbalance) : 0;
      if (user.parent) u.parent = model(user.parent, PARENT_PUBLIC);
      return { ...u };
    });

    return res.json(
      success({
        users,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limitNum),
        currentPage: pageNum,
        totalBalance,
        totalVirtualBalance,
      })
    );
  }

  if (req.method == "POST") {
    console.log("POST ...");

    const { action, id } = req.body;
    console.log({ action, id });

    if (action == "migrate") {
      console.log("migrate ...");

      // migrar transacciones virtuales solo las que fueron creadas después del último cierre
      // y que NO sean transacciones "closed reset" (compensaciones de cierre)
      // y que NO sean transacciones que ya fueron compensadas por "closed reset"
      // Primero obtener la fecha del último cierre
      const lastClosed = await Closed.findOne({}, { sort: { date: -1 } });
      
      // Obtener todas las transacciones "closed reset" del usuario, ordenadas por fecha
      const closedResetTransactions = await Transaction.find({
        user_id: id,
        name: "closed reset",
        virtual: true
      });
      
      // Ordenar los "closed reset" por fecha (más antiguos primero)
      closedResetTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Obtener TODAS las transacciones virtuales del usuario (excepto "closed reset")
      // para procesarlas en orden cronológico
      let allVirtualTransactions = await Transaction.find({
        user_id: id,
        virtual: true,
        name: { $ne: "closed reset" }
      });
      // Ordenar por fecha (más antiguas primero)
      allVirtualTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Identificar qué transacciones fueron compensadas por cada "closed reset"
      // IMPORTANTE: Una transacción solo puede ser compensada UNA VEZ
      const compensatedTransactionIds = new Set(); // Usar Set para evitar duplicados
      
      // Para cada "closed reset", identificar las transacciones que compensó
      for (const resetTransaction of closedResetTransactions) {
        // Obtener todas las transacciones virtuales que existían ANTES o EN la fecha del reset
        // y que NO hayan sido compensadas previamente
        const transactionsAvailableForReset = allVirtualTransactions.filter(t => {
          // Solo considerar transacciones que existían antes o en la fecha del reset
          const transactionDate = new Date(t.date);
          const resetDate = new Date(resetTransaction.date);
          return transactionDate <= resetDate && !compensatedTransactionIds.has(t.id);
        });
        
        // Simular la compensación: sumar transacciones hasta alcanzar el valor del reset
        let remainingToCompensate = Math.abs(resetTransaction.value); // Valor absoluto porque es negativo
        const transactionsToCompensate = [];
        
        for (const transaction of transactionsAvailableForReset) {
          if (remainingToCompensate <= 0) break;
          
          // Solo considerar transacciones de tipo "in" (entradas)
          if (transaction.type === 'in') {
            if (transaction.value <= remainingToCompensate) {
              // Esta transacción fue completamente compensada
              transactionsToCompensate.push(transaction.id);
              remainingToCompensate -= transaction.value;
            } else {
              // Esta transacción fue parcialmente compensada
              // Por ahora, la consideramos compensada completamente
              // En el futuro se podría manejar compensaciones parciales
              transactionsToCompensate.push(transaction.id);
              remainingToCompensate = 0;
              break;
            }
          }
        }
        
        // Agregar los IDs de las transacciones que fueron compensadas por este reset
        transactionsToCompensate.forEach(id => compensatedTransactionIds.add(id));
      }
      
      let virtualTransactionsQuery = {
        user_id: id,
        virtual: true,
        name: { $ne: "closed reset" } // Excluir transacciones de compensación de cierre
      };
      
      // Si hay un cierre anterior, solo migrar transacciones creadas después de ese cierre
      if (lastClosed) {
        virtualTransactionsQuery.date = { $gte: lastClosed.date };
      }
      
      const transactions = await Transaction.find(virtualTransactionsQuery);
      
      // Filtrar transacciones que NO fueron compensadas por "closed reset"
      const validTransactions = transactions.filter(transaction => {
        // Si esta transacción está en la lista de compensadas, no migrarla
        return !compensatedTransactionIds.has(transaction.id);
      });
      
      // console.log({ transactions })

      for (let transaction of validTransactions) {
        console.log({ transaction });

        await Transaction.update({ id: transaction.id }, { virtual: false });
      }
    }

    if (action == "name") {
      // console.log('edit name ...')

      const {
        _name,
        _lastName,
        _dni,
        _password,
        _parent_dni,
        _points,
        _rank,
        city,
        plan,
        affiliation_points,
      } = req.body.data;

      // Aqui se escribia en el registro del servidor todo lo que llega del
      // formulario, incluida la contraseña nueva en texto legible. Quien tenga
      // acceso al registro leia la clave de cualquier socio a quien un
      // administrador se la hubiera cambiado.

      // Los puntos entran en la cascada que recalcula la red y deciden si el
      // socio queda activado. Si llegan como texto, la suma de aguas abajo da
      // 'NaN' y el calculo de toda la rama queda roto.
      if (_points !== undefined && !Number.isFinite(Number(_points))) {
        return res.json(error("invalid points"));
      }
      if (
        affiliation_points !== undefined &&
        !Number.isFinite(Number(affiliation_points))
      ) {
        return res.json(error("invalid affiliation points"));
      }

      const user = await User.findOne({ id });

      if (_dni != user.dni) {
        // error dni
        const user2 = await User.findOne({ dni: _dni });

        if (user2) return res.json(error("invalid dni"));
      }

      await User.update(
        { id },
        {
          name: _name,
          lastName: _lastName,
          dni: _dni,
          points: _points === undefined ? undefined : Number(_points),
          rank: _rank,
          city,
          plan,
          affiliation_points:
            affiliation_points === undefined
              ? undefined
              : Number(affiliation_points),
        }
      );

      // Recalcular activated y propagar total_points en cascada
      // (la edición directa de puntos desde admin no pasaba por esta lógica)
      const newActivated = user.activated ? true : (_points >= 120);
      await User.update({ id }, { activated: newActivated });
      await lib.updateTotalPointsCascade(User, Tree, id);

      if (_password) {
        const password = await bcrypt.hash(_password, 12);

        await User.update({ id }, { password });
      }

      if (_parent_dni) {
        const parent = await User.findOne({ dni: _parent_dni });

        if (!parent) return res.json(error("invalid parent dni"));
        if (parent.id == user.id) return res.json(error("invalid parent dni"));

        await User.update({ id }, { parentId: parent.id });
      }
    }

    if (action == "add_rank_history") {
      const user = await User.findOne({ id });
      if (!user) return res.json(error("user not found"));

      const {
        rank,
        date,
        period,
      } = req.body.data || {};

      if (!rank) return res.json(error("rank is required"));

      const parsedDate = date ? new Date(date) : new Date();
      if (isNaN(parsedDate.getTime())) return res.json(error("invalid date"));

      const entry = {
        rank: String(rank),
        date: parsedDate,
        period: period || periodFromDate(parsedDate),
        residual_bonus: 0,
        points: 0,
      };

      const rankHistory = Array.isArray(user.rank_history) ? user.rank_history : [];
      rankHistory.push(entry);

      rankHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

      await User.update({ id }, { rank_history: rankHistory });
    }

    if (action == "remove_rank_history") {
      const user = await User.findOne({ id });
      if (!user) return res.json(error("user not found"));

      const { rank, date, period } = req.body.data || {};
      if (!rank || date == null || date === "")
        return res.json(error("rank and date are required"));

      const rankHistory = Array.isArray(user.rank_history)
        ? [...user.rank_history]
        : [];
      const idx = rankHistory.findIndex((e) =>
        matchesRankHistoryEntry(e, { rank, date, period })
      );
      if (idx === -1) return res.json(error("rank history entry not found"));

      rankHistory.splice(idx, 1);
      await User.update({ id }, { rank_history: rankHistory });
    }

    if (action == "block") {
      const user = await User.findOne({ id });
      if (!user) return res.json(error("user not found"));
      if (user.status === "blocked") return res.json(error("already blocked"));
      if (user.status === "eliminated") return res.json(error("user is eliminated"));

      const { reason } = req.body.data || {};

      await User.update({ id }, { 
        status: "blocked", 
        statusReason: reason || "Bloqueado manualmente por admin",
        blocked_at: new Date() 
      });

      // Cerrar todas las sesiones activas del usuario
      await Session.deleteMany({ id: user.id });

      await lib.createAuditLog(AuditLog, {
        collection: "users",
        action: "block",
        target_id: id,
        user_id: id,
        admin_id: auth.user.id,
        state_before: { status: user.status || "active" },
        state_after:  { status: "blocked", reason: reason }
      });
    }

    if (action == "unblock") {
      const user = await User.findOne({ id });
      if (!user) return res.json(error("user not found"));
      if (user.status !== "blocked") return res.json(error("user is not blocked"));

      await User.update({ id }, { status: "active", unblocked_at: new Date() });

      await lib.createAuditLog(AuditLog, {
        collection: "users",
        action: "unblock",
        target_id: id,
        user_id: id,
        admin_id: auth.user.id,
        state_before: { status: "blocked" },
        state_after:  { status: "active" }
      });
    }

    if (action == "eliminate") {
      const user = await User.findOne({ id });
      if (!user) return res.json(error("user not found"));
      if (user.status === "eliminated") return res.json(error("already eliminated"));

      const { reason } = req.body.data || {};

      const treeCompression = await lib.compressTreeOnElimination(
        Tree,
        User,
        user.id
      );
      if (treeCompression.previousParent) {
        await lib.updateTotalPointsCascade(
          User,
          Tree,
          treeCompression.previousParent
        );
      }

      const ts = Math.floor(Date.now() / 1000);
      const newDni = `del_${ts}_${user.dni}`;
      const newEmail = user.email ? `del_${ts}_${user.email}` : user.email;
      const newPhone = user.phone ? `del_${ts}_${user.phone}` : user.phone;
      const newName = user.name + " (Eliminado)";

      // Marcar como eliminado (NO se borra el documento — conservamos historial)
      await User.update({ id }, {
        status: "eliminated",
        statusReason: reason || "Eliminado manualmente por admin",
        eliminated_at: new Date(),
        dni: newDni,
        email: newEmail,
        phone: newPhone,
        name: newName,
        // Deshabilitar su nodo en el árbol sin borrarlo
      });

      // Cerrar todas las sesiones activas del usuario
      await Session.deleteMany({ id: user.id });

      await lib.createAuditLog(AuditLog, {
        collection: "users",
        action: "eliminate",
        target_id: id,
        user_id: id,
        admin_id: auth.user.id,
        state_before: { status: user.status || "active", parentId: user.parentId },
        state_after:  { status: "eliminated", reason: reason, tree_compression: treeCompression }
      });
    }

    if (action == "reactivate") {
      const user = await User.findOne({ id });
      if (!user) return res.json(error("user not found"));
      if (!user.status || user.status === "active") return res.json(error("user is already active"));

      await User.update({ id }, { status: "active", reactivated_at: new Date() });

      // Re-insertar en el arbol como DIRECTO de su patrocinador. Al eliminar se
      // comprimio la red (los hijos subieron al padre) y el nodo quedo fuera del
      // arbol, por lo que la persona no aparece para su patrocinador. NO se
      // restaura la downline antigua: solo se reincorpora este nodo bajo su
      // patrocinador. Idempotente (si venia de 'blocked' y ya figura, no duplica).
      const treeReinserted = await lib.reinsertIntoSponsorTree(Tree, User, user);

      await lib.createAuditLog(AuditLog, {
        collection: "users",
        action: "reactivate",
        target_id: id,
        user_id: id,
        admin_id: auth.user.id,
        state_before: { status: user.status },
        state_after:  { status: "active", tree_reinserted: treeReinserted, parentId: user.parentId || null }
      });
    }

    // response
    return res.json(success({}));
  }
};

export default async (req, res) => {
  await midd(req, res);
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  return handler(req, res, auth);
};
