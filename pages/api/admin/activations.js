import db from "../../../components/db";
import lib from "../../../components/lib";
import { MongoClient } from "mongodb";

const URL = process.env.DB_URL; // Asegúrate de que esta variable esté definida correctamente
const name = process.env.DB_NAME;

const { Activation, Affiliation, User, Tree, Token, Office, Transaction, Closed, Period } = db;
const { error, success, midd, ids, map, model, rand } = lib;

/**
 * Determina el periodo correcto al momento de la aprobación.
 * Reglas:
 *   - Si hay periodo ABIERTO en approvedAt  -> ese periodo
 *   - Si todos están cerrados y approvedAt <= closedAt de alguno -> el más reciente con closedAt >= approvedAt
 *   - Si no cumple ningún criterio -> el periodo abierto más reciente o null
 */
async function resolvePeriodAtApproval(approvedAt) {
  const allPeriods = await Period.find({});
  if (!allPeriods || !allPeriods.length) return null;

  // Buscar periodos abiertos al momento de la aprobación:
  // Un periodo estaba abierto si: createdAt <= approvedAt Y (closedAt == null O approvedAt <= closedAt)
  const openAtApproval = allPeriods.filter((p) => {
    const createdAt = p.createdAt ? new Date(p.createdAt) : null;
    if (!createdAt || isNaN(createdAt)) return false;
    if (createdAt > approvedAt) return false; // el periodo aún no había empezado
    if (p.status === 'open') return true;     // sigue abierto
    // cerrado: verificar si approvedAt es antes de o igual al cierre
    if (p.closedAt) {
      const closedAt = new Date(p.closedAt);
      return approvedAt <= closedAt; // aprobado dentro del periodo (incluyendo el instante exacto de cierre)
    }
    return false;
  });

  if (openAtApproval.length > 0) {
    // Usar el más reciente por createdAt
    openAtApproval.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return openAtApproval[0];
  }

  // Si ya todos cerraron antes de approvedAt → usar el periodo ABIERTO actual o el más reciente
  const openPeriods = allPeriods.filter((p) => p.status === 'open');
  if (openPeriods.length > 0) {
    openPeriods.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return openPeriods[0];
  }

  // Último recurso: periodo cerrado más reciente
  allPeriods.sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0));
  return allPeriods[0] || null;
}

// valid filters
// const q = { all: {}, pending: { status: 'pending'} }

// models
const A = [
  "id",
  "date",
  "products",
  "price",
  "points",
  "voucher",
  "voucher2",
  "status",
  "amounts",
  "office",
  "delivered",
  "closed",
  "pay_method",
  "bank",
  "bank_info",
  "voucher_date",
  "voucher_number",
  "delivery_info",
  "period_key",    // Periodo al momento de aprobación
  "period_label",  // Label del periodo al momento de aprobación
  "approved_at",   // Fecha y hora exacta de aprobación
];
const U = ["name", "lastName", "dni", "phone"];

/*
function find(id, i) { // i: branch
  const node = tree.find(e => e.id == id)

  if(node.childs[i] == null) return id

  return find(node.childs[i], i)
} */

export default async (req, res) => {
  await midd(req, res);

  if (req.method === "GET") {
    const { filter, page = 1, limit = 20, search, timeRange } = req.query;
    console.log("Received request with page:", page, "and limit:", limit);
    const q = { all: {}, pending: { status: "pending" } };
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (!(filter in q)) return res.json(lib.error("invalid filter"));

    // Construir un objeto de búsqueda
    let userSearchQuery = {};
    if (search) {
      const searchWords = search
        .trim()
        .split(/\s+/)
        .map((w) => w.toLowerCase());
      userSearchQuery = {
        $and: searchWords.map((word) => ({
          $or: [
            { name: { $regex: word, $options: "i" } },
            { lastName: { $regex: word, $options: "i" } },
            { dni: { $regex: word, $options: "i" } },
            { phone: { $regex: word, $options: "i" } },
          ],
        })),
      };
    }

    const skip = (pageNum - 1) * limitNum;
    console.log(
      "Calculated skip:",
      skip,
      "using pageNum:",
      pageNum,
      "and limitNum:",
      limitNum
    );

    let dateFilter = {};

    if (timeRange) {
      const now = new Date();
      switch (timeRange) {
        case "week":
          dateFilter = {
            date: {
              $gte: new Date(now.setDate(now.getDate() - 7)),
            },
          };
          break;
        case "month":
          dateFilter = {
            date: {
              $gte: new Date(now.setMonth(now.getMonth() - 1)),
            },
          };
          break;
        case "year":
          dateFilter = {
            date: {
              $gte: new Date(now.setFullYear(now.getFullYear() - 1)),
            },
          };
          break;
      }
    }

    try {
      const client = new MongoClient(URL);
      await client.connect();
      const db = client.db(name);

      // --- NUEVO FILTRO COMBINADO ---
      // Construir el filtro base (estado)
      let baseFilter = {};
      if (filter && filter !== "all") {
        baseFilter.status = filter;
      }
      // Agregar filtro de fecha si aplica
      if (Object.keys(dateFilter).length > 0) {
        baseFilter = { ...baseFilter, ...dateFilter };
      }
      // Si hay búsqueda, busca los usuarios y filtra por userId
      if (search) {
        const users = await db
          .collection("users")
          .find(userSearchQuery)
          .toArray();
        const userIds = users.map((user) => String(user.id));
        console.log("Filtrando activaciones por userIds:", userIds);
        if (userIds.length > 0) {
          baseFilter.userId = { $in: userIds };
        } else {
          // Si no hay usuarios que coincidan, no devolver nada
          baseFilter.userId = "__NO_MATCH__";
        }
      }
      // --- FIN NUEVO FILTRO ---

      // Filtrar activaciones según el filtro combinado
      const activationsCursor = db
        .collection("activations")
        .find(baseFilter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum);

      const activations = await activationsCursor.toArray();

      const totalActivations = await db
        .collection("activations")
        .countDocuments(baseFilter); // Contar documentos que coinciden

      console.log("Type of page:", typeof page, "Value:", page);
      console.log("Type of limit:", typeof limit, "Value:", limit);
      client.close();

      // Obtener usuarios relacionados con las activaciones
      let relatedUsers = await User.find({ id: { $in: lib.ids(activations) } });
      relatedUsers = lib.map(relatedUsers);

      const enrichedActivations = activations.map((a) => {
        let u = relatedUsers.get(a.userId);
        a = lib.model(a, A);
        u = lib.model(u, U);
        return { ...a, ...u };
      });

      return res.json(
        lib.success({
          activations: enrichedActivations,
          total: totalActivations,
          totalPages: Math.ceil(totalActivations / limitNum),
          currentPage: pageNum,
        })
      );
    } catch (error) {
      console.error("Database connection error:", error);
      return res.status(500).json(lib.error("Database connection error"));
    }
  }

  if (req.method == "POST") {
    const { action, id } = req.body;

    // get activation
    const activation = await Activation.findOne({ id });

    // validate activation
    if (!activation) return res.json(error("activation not exist"));

    // validate status
    if (action == "approve" || action == "reject") {
      if (activation.status == "approved")
        return res.json(error("already approved"));
      if (activation.status == "rejected")
        return res.json(error("already rejected"));
    }

    if (action == "approve") {
      // Validar duplicado de voucher antes de proceder
      if (activation.pay_method === "bank" && activation.voucher_number) {
        const vn = String(activation.voucher_number).trim();
        const dupAct = await Activation.findOne({
          voucher_number: vn,
          status: "approved",
          id: { $ne: id },
        });
        const dupAff = await Affiliation.findOne({
          voucher_number: vn,
          status: "approved",
        });

        if (dupAct || dupAff) {
          return res.json(
            error(
              `El número de operación "${vn}" ya ha sido utilizado en otro pago aprobado.`
            )
          );
        }
      }

      console.log("1");
      // approve activation
      // Calcular el periodo correcto según el momento exacto de la aprobación
      const approvedAt = new Date();
      const resolvedPeriod = await resolvePeriodAtApproval(approvedAt);
      const approvedPeriodKey   = resolvedPeriod ? resolvedPeriod.key   : (activation.period_key   || null);
      const approvedPeriodLabel = resolvedPeriod ? resolvedPeriod.label : (activation.period_label || null);
      console.log('[Approve Activation] approved_at:', approvedAt, '| periodo resuelto:', approvedPeriodKey);

      // Marcar delivered como false para nuevas aprobaciones (control manual)
      await Activation.update({ id }, {
        status: "approved",
        delivered: false,
        approved_at: approvedAt,
        period_key: approvedPeriodKey,
        period_label: approvedPeriodLabel,
      });

      // update USER
      const user = await User.findOne({ id: activation.userId });

      // const points_total  = user.points.total  + activation.points
      // const points_period = user.points.period + activation.points

      const points_total = user.points + activation.points;
      console.log({ points_total });

      // Verificar si el usuario estaba activado ANTES de esta aprobación
      const wasActivatedBefore = user.activated;
      
      const activated = user.activated ? true : points_total >= 120;
      console.log({ activated });
      console.log('Usuario estaba activado antes:', wasActivatedBefore);
      console.log('Usuario está activado ahora:', activated);

      await User.update(
        { id: user.id },
        {
          activated,
          points: points_total,
        }
      );
      await lib.updateTotalPointsCascade(User, Tree, user.id);

      // Migrar saldo solo cuando el usuario se activa por primera vez (cambia de false a true)
      // Esto ocurre cuando el usuario alcanza 120 puntos por primera vez
      const isFirstTimeActivation = !wasActivatedBefore && activated;
      
      console.log('¿Es primera activación?', isFirstTimeActivation);
      console.log('Puntos totales:', points_total);
      
      if (isFirstTimeActivation) {
        console.log('🔄 Iniciando migración de saldo no disponible a disponible...');
        
        // migrar transacciones virtuales solo las que fueron creadas después del último cierre
        // y que NO sean transacciones "closed reset" (compensaciones de cierre)
        // y que NO sean transacciones que ya fueron compensadas por "closed reset"
        // Primero obtener la fecha del último cierre
        const allCloseds = await Closed.find({});
        const lastClosed = allCloseds.length > 0 
          ? allCloseds.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
          : null;
        
        // Obtener todas las transacciones "closed reset" del usuario, ordenadas por fecha
        const closedResetTransactions = await Transaction.find({
          user_id: user.id,
          name: "closed reset",
          virtual: true
        });
        
        // Ordenar los "closed reset" por fecha (más antiguos primero)
        closedResetTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Obtener TODAS las transacciones virtuales del usuario (excepto "closed reset")
        // para procesarlas en orden cronológico
        const allVirtualTransactionsRaw = await Transaction.find({
          user_id: user.id,
          virtual: true,
          name: { $ne: "closed reset" }
        });
        // Ordenar por fecha (más antiguas primero) - ordenar el array después de obtenerlo
        const allVirtualTransactions = allVirtualTransactionsRaw.sort((a, b) => {
          return new Date(a.date) - new Date(b.date);
        });
        
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
          user_id: user.id,
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

        for (let transaction of validTransactions) {
          console.log({ transaction });
          await Transaction.update({ id: transaction.id }, { virtual: false });
        }
      }

      // UPDATE STOCK
      console.log("UPDATE STOCK ...");
      const office_id = activation.office;
      const products = activation.products || []; // Asegurarse de que products sea un array

      // console.log({ office_id, products })

      const office = await Office.findOne({ id: office_id });

      // console.log(office)

      products.forEach((p, i) => {
        if (office.products[i]) office.products[i].total -= products[i].total;
      });

      await Office.update(
        { id: office_id },
        {
          products: office.products,
        }
      );

      // console.log(office)

      // Profit office
      // let office_profit_total = office.profit ? office.profit : 0

      // if(points_total) {
      //   console.log(':)')
      //   office_profit_total += 5 * (activation.total - activation._total)
      //   office_profit_total += 2.5 * (activation._total)
      // }

      // await Office.update({ id: office_id }, {
      //   products: office.products,
      //   profit: office_profit_total,
      // })

      // PAY BONUS
      console.log("PAY BONUS ...");

      if (user.parentId) {
        const activationProducts = activation.products || []; // Asegurarse de que products sea un array
        const amount = activationProducts
          .filter((p) => p && p.type === "Promoción") // Verificar que p no sea null/undefined
          .reduce((a, p) => a + (p && typeof p.total === 'number' ? p.total : 0) * 10, 0); // Verificar p y p.total
        console.log("amunt: ", amount);

        if (amount) {
          const parent = await User.findOne({ id: user.parentId });
          if (!parent) {
            console.error("Parent user not found for userId:", user.parentId);
            return;
          }
          const id = rand();
          const virtual = parent.activated ? false : true;
          console.log("parent: ", parent);

          await Transaction.insert({
            id,
            date: new Date(),
            user_id: parent.id,
            type: "in",
            value: amount,
            name: "activation bonnus promo",
            activation_id: activation.d,
            virtual,
            _user_id: user.id,
          });

          activation.transactions.push(id);

          await Activation.update(
            { id: activation.id },
            {
              transactions: activation.transactions,
            }
          );
        }
      }

      // response
      return res.json(success());
    }

    if (action == "reject") {
      // reject activation
      await Activation.update({ id }, { status: "rejected" });

      // revert transactions
      if (activation.transactions) {
        for (let transactionId of activation.transactions) {
          await Transaction.delete({ id: transactionId });
        }
      }

      // response
      return res.json(success());
    }

    if (action == "check") {
      console.log("check");
      await Activation.update({ id }, { delivered: true });
    }

    if (action == "uncheck") {
      console.log("uncheck");
      await Activation.update({ id }, { delivered: false });
    }

    if (action == "revert") {
      console.log("revert");

      const user = await User.findOne({ id: activation.userId });

      await Activation.delete({ id });

      user.points = user.points - activation.points;

      await User.update({ id: user.id }, { points: user.points });
      const activated = user.activated ? true : user.points >= 120;

      await User.update(
        { id: user.id },
        {
          activated,
        }
      );

      const transactions = activation.transactions;
      console.log(transactions);

      for (let id of transactions) {
        await Transaction.delete({ id });
      }

      // UPDATE STOCK
      console.log("UPDATE STOCK ...");
      const office_id = activation.office;
      const products = activation.products || []; // Asegurarse de que products sea un array
      const office = await Office.findOne({ id: office_id });
      if (office && Array.isArray(products)) {
        products.forEach((p, i) => {
          if (office.products[i]) office.products[i].total += products[i].total;
        });
        await Office.update(
          { id: office_id },
          {
            products: office.products,
          }
        );
      }
    }

    if (action == "change") {
      console.log("change");

      const { points } = req.body;
      console.log({ points });

      await Activation.update({ id }, { points });
    }

    if (action == "cancel") {
      console.log("Cancelando activación...");
      
      // Marcar la activación como cancelada (NO eliminarla)
      await Activation.update({ id }, { status: "cancelled", cancelled_at: new Date() });
      
      // Si la activación fue aprobada, revertir los puntos del usuario
      if (activation.status === "approved") {
        const user = await User.findOne({ id: activation.userId });
        
        // Restar los puntos de la activación
        const new_points = user.points - activation.points;
        console.log(`Revirtiendo puntos: ${user.points} - ${activation.points} = ${new_points}`);
        
        // Recalcular estados de activación
        const activated = user.activated ? (new_points >= 120) : false;
        
        await User.update(
          { id: user.id },
          {
            points: new_points,
            activated,
          }
        );
        
        // Actualizar total_points en cascada
        await lib.updateTotalPointsCascade(User, Tree, user.id);
      }
      
      // Eliminar las transacciones asociadas (ya que fueron revertidas)
      if (activation.transactions) {
        for (let transactionId of activation.transactions) {
          await Transaction.delete({ id: transactionId });
        }
      }
      
      // Actualizar stock (devolver productos al inventario)
      const office_id = activation.office;
      const products = activation.products || [];
      const office = await Office.findOne({ id: office_id });
      if (office && Array.isArray(products)) {
        products.forEach((p, i) => {
          if (office.products[i]) {
            office.products[i].total += products[i].total;
          }
        });
        await Office.update(
          { id: office_id },
          {
            products: office.products,
          }
        );
      }
      
      return res.json(success({ message: "Activación anulada correctamente" }));
    }

    return res.json(success());
  }
};
