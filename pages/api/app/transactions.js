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
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // get USER
  const user = await User.findOne({ id: session.id })
  console.log({ user })

  const users = await User.find({})

  // get TRANSACTIONS
  // let transactions = await Transaction.find({ userId: user.id, virtual: {$in: [null, false]} })
  let transactions = await Transaction.find({ user_id: user.id })
  console.log({ transactions })

  // Filtrar transacciones "closed reset" y las compensadas
  // 1. Obtener todas las transacciones "closed reset" del usuario
  const closedResetTransactions = await Transaction.find({
    user_id: user.id,
    name: "closed reset",
    virtual: true
  });
  
  // 2. Para cada "closed reset", identificar las transacciones que realmente compensó
  const compensatedTransactionIds = [];
  
  for (const resetTransaction of closedResetTransactions) {
    // Obtener todas las transacciones que existían ANTES del "closed reset"
    const transactionsBeforeReset = await Transaction.find({
      user_id: user.id,
      virtual: true,
      name: { $ne: "closed reset" },
      date: { $lt: resetTransaction.date } // Solo transacciones ANTES del reset
    });
    
    // Ordenar por fecha (más antiguas primero) para compensar en orden cronológico
    transactionsBeforeReset.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Simular la compensación: sumar transacciones hasta alcanzar el valor del reset
    let remainingToCompensate = resetTransaction.value;
    const transactionsToCompensate = [];
    
    for (const transaction of transactionsBeforeReset) {
      if (remainingToCompensate <= 0) break;
      
      if (transaction.value <= remainingToCompensate) {
        // Esta transacción fue completamente compensada
        transactionsToCompensate.push(transaction.id);
        remainingToCompensate -= transaction.value;
      } else {
        // Esta transacción fue parcialmente compensada
        // Por ahora, la consideramos compensada completamente
        transactionsToCompensate.push(transaction.id);
        remainingToCompensate = 0;
        break;
      }
    }
    
    // Agregar los IDs de las transacciones que fueron compensadas
    compensatedTransactionIds.push(...transactionsToCompensate);
  }
  
  // 3. Filtrar transacciones: excluir "closed reset" y las compensadas
  transactions = transactions.filter(transaction => {
    // Excluir transacciones "closed reset"
    if (transaction.name === "closed reset") {
      return false;
    }
    
    // Excluir transacciones que fueron compensadas por "closed reset"
    if (compensatedTransactionIds.includes(transaction.id)) {
      return false;
    }
    
    return true;
  });

  transactions = transactions.map(a => {

    if(a._user_id) {

      const u = users.find(e => e.id == a._user_id)

      return { ...a, user_name: u.name + ' ' + u.lastName }

    }

    return { ...a }
  })

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
