const cors = require('micro-cors')()

import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Transaction, Closed } = db
const { error, success } = lib
// const { error, success, model } = lib

// models
// const T = ['date', 'name', 'type', 'value']


const transactions = async (req, res) => {

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: String(session ?? '') })
  if(!session) return res.json(error('invalid session'))

  // get USER
  const user = await User.findOne({ id: session.id })
  if(!user) return res.json(error('invalid session'))

  const users = await User.find({})

  // get TRANSACTIONS
  // let transactions = await Transaction.find({ userId: user.id, virtual: {$in: [null, false]} })
  let transactions = await Transaction.find({ user_id: user.id })

  // Filtrar transacciones "closed reset" y las compensadas
  // IMPORTANTE: Las transacciones que fueron compensadas por "closed reset" NO deben aparecer en los movimientos
  // 1. Obtener todas las transacciones "closed reset" del usuario, ordenadas por fecha
  const closedResetTransactions = await Transaction.find({
    user_id: user.id,
    name: "closed reset",
    virtual: true
  });
  
  // Ordenar los "closed reset" por fecha (más antiguos primero)
  closedResetTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // 2. Obtener TODAS las transacciones virtuales del usuario (excepto "closed reset")
  // para procesarlas en orden cronológico
  let allVirtualTransactions = await Transaction.find({
    user_id: user.id,
    virtual: true,
    name: { $ne: "closed reset" }
  });
  // Ordenar por fecha (más antiguas primero)
  allVirtualTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // 3. Identificar qué transacciones fueron compensadas por cada "closed reset"
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
  
  // 4. Filtrar transacciones: excluir "closed reset" y las compensadas
  console.log(`📊 Total transacciones antes de filtrar: ${transactions.length}`);
  console.log(`📊 Total transacciones compensadas: ${compensatedTransactionIds.size}`);
  console.log(`📊 IDs de transacciones compensadas:`, Array.from(compensatedTransactionIds));
  
  const totalBeforeFilter = transactions.length;
  transactions = transactions.filter(transaction => {
    // Excluir transacciones "closed reset"
    if (transaction.name === "closed reset") {
      console.log(`🚫 Excluyendo "closed reset": ${transaction.id}`);
      return false;
    }
    
    // Excluir transacciones que fueron compensadas por "closed reset"
    if (compensatedTransactionIds.has(transaction.id)) {
      console.log(`🚫 Excluyendo transacción compensada: ${transaction.id} - ${transaction.name} - ${transaction.value}`);
      return false;
    }
    
    return true;
  });
  
  console.log(`📊 Total transacciones después de filtrar: ${transactions.length}`);
  console.log(`📊 Transacciones ocultadas: ${totalBeforeFilter - transactions.length}`);

  const userMap = new Map();
  for (const u of users) {
    if (u && u.id != null) {
      userMap.set(String(u.id), u);
    }
  }

  transactions = transactions.map(a => {
    let userName = a.affiliate_name || null;
    const originId = a._user_id || a.from_user_id;
    if (!userName && originId) {
      const u = userMap.get(String(originId));
      if (u) {
        userName = `${u.name || ''} ${u.lastName || ''}`.trim();
      }
    }
    if (!userName && a.user_name) {
      userName = a.user_name;
    }

    return {
      ...a,
      user_name: userName || null,
      affiliate_name: a.affiliate_name || userName || null,
    };
  });

  // response
  return res.json(success({
    name:       user.name,
    lastName:   user.lastName,
    affiliated: user.affiliated,
    _activated: user._activated,
    activated:  user.activated,
    plan:       user.plan,
    country:    user.country,
    photo:      user.photo,
    tree:       user.tree,

    transactions,
  }))
}

module.exports = cors(transactions)
