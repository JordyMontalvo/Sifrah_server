import db from "../../../components/db";
import lib from "../../../components/lib";
const nodemailer = require('nodemailer');
require('dotenv').config();

// Función inline para enviar el email de bienvenida SIFRAH
async function sendSifrahWelcomeEmail({ email, name, lastName, dni }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: { rejectUnauthorized: false }
  });

  const dashboardUrl = (process.env.FRONTEND_URL || 'https://sifrah.vercel.app') + '/dashboard';
  const tutorialUrl = 'https://www.youtube.com/playlist?list=PLWYJViqkAe6G0cmbXbTXfDORD0DomWWzY';
  const whatsappUrl = 'https://wa.me/51959141444';

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenido a SIFRAH</title>
      <style>
        body { margin:0; padding:0; background:#0f0f1a; font-family:Arial,sans-serif; }
        .wrap { background:#0f0f1a; padding:30px 15px; }
        .box { max-width:580px; margin:0 auto; background:#1a1a2e; border-radius:14px; overflow:hidden; }
        .hdr { background:linear-gradient(135deg,#7c3aed,#a855f7,#c084fc); padding:35px 25px; text-align:center; }
        .hdr h1 { color:#fff; margin:8px 0 0; font-size:22px; font-weight:800; }
        .hdr p { color:rgba(255,255,255,.85); margin:8px 0 0; font-size:14px; }
        .body { padding:28px 25px; color:#e2e8f0; }
        .intro { font-size:14px; line-height:1.7; color:#cbd5e1; margin-bottom:20px; }
        .creds { background:linear-gradient(135deg,#1e1b4b,#2d1b69); border:1px solid #7c3aed; border-radius:10px; padding:20px; margin:18px 0; }
        .creds h3 { color:#c084fc; margin:0 0 12px; font-size:13px; text-transform:uppercase; letter-spacing:1px; }
        .row { margin:8px 0; font-size:14px; }
        .lbl { color:#94a3b8; font-weight:600; display:inline-block; min-width:100px; }
        .val { color:#f1f5f9; font-weight:700; background:rgba(124,58,237,.2); padding:3px 10px; border-radius:5px; font-family:monospace; }
        .btn { display:block; background:linear-gradient(135deg,#7c3aed,#a855f7); color:#fff!important; text-decoration:none; text-align:center; padding:14px 25px; border-radius:9px; font-weight:700; font-size:15px; margin:20px 0; }
        .note { background:rgba(168,85,247,.1); border-left:4px solid #a855f7; padding:12px 16px; border-radius:0 7px 7px 0; margin:15px 0; }
        .note p { margin:0; color:#c084fc; font-size:13px; font-weight:600; }
        .sec { color:#a855f7; font-size:14px; font-weight:700; margin:20px 0 10px; }
        .tut { display:block; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:9px; padding:13px 15px; text-decoration:none; color:#e2e8f0; margin-bottom:10px; font-size:14px; }
        .wa { display:block; background:#25D366; color:#fff!important; text-decoration:none; text-align:center; padding:13px 20px; border-radius:9px; font-weight:700; font-size:14px; margin:12px 0; }
        .ftr { background:#0f0f1a; padding:20px; text-align:center; }
        .ftr p { color:#475569; font-size:12px; margin:4px 0; }
        .ftr .brand { color:#7c3aed; font-weight:700; font-size:15px; }
        .hr { height:1px; background:rgba(255,255,255,.07); margin:18px 0; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="box">
          <div class="hdr">
            <div style="font-size:36px">🌟</div>
            <h1>¡Bienvenido(a) oficialmente a la familia SIFRAH!</h1>
            <p>Hola <strong>${name} ${lastName}</strong> — ¡ya eres parte del sistema! 💜</p>
          </div>
          <div class="body">
            <p class="intro">Nos alegra que hayas tomado la decisión de construir tu libertad y formar parte de una comunidad que transforma vidas desde la <strong style="color:#c084fc">salud</strong>, la <strong style="color:#c084fc">educación</strong> y las <strong style="color:#c084fc">finanzas</strong>. 💜</p>

            <p class="sec">🚀 Tu acceso a la plataforma virtual</p>
            <div class="creds">
              <h3>📌 Credenciales de acceso</h3>
              <div class="row"><span class="lbl">🔗 Plataforma:</span> <span class="val">${dashboardUrl}</span></div>
              <div class="row" style="margin-top:8px"><span class="lbl">👤 Usuario:</span> <span class="val">${dni || 'Tu DNI'}</span></div>
              <div class="row" style="margin-top:6px"><span class="lbl">🔒 Contraseña:</span> <span class="val">123456</span></div>
            </div>

            <a href="${dashboardUrl}" class="btn">🚀 Ingresar a mi plataforma</a>

            <div class="note"><p>📌 Una vez dentro, ve a la sección <strong>"Perfil"</strong> para personalizar tu contraseña.</p></div>

            <div class="hr"></div>
            <p class="sec">🎓 Tutoriales de tu oficina virtual</p>
            <p style="color:#94a3b8;font-size:13px;margin-bottom:12px">Aquí aprenderás paso a paso cómo usar tu plataforma:</p>
            <a href="${tutorialUrl}" class="tut">📺 &nbsp;Ver tutoriales en YouTube — Lista oficial SIFRAH</a>

            <div class="hr"></div>
            <p class="sec">💬 ¿Necesitas ayuda?</p>
            <a href="${whatsappUrl}" class="wa">📱 WhatsApp de Soporte: +51 959 141 444</a>
          </div>
          <div class="ftr">
            <p class="brand">SIFRAH</p>
            <p>Salud · Educación · Finanzas</p>
            <p style="margin-top:8px">© ${new Date().getFullYear()} SIFRAH Network. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const info = await transporter.sendMail({
    from: `"SIFRAH" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🌟 ¡Bienvenido(a) oficialmente a la familia SIFRAH! 🌟',
    html
  });

  console.log('[SIFRAH Email] Enviado a:', email, '| messageId:', info.messageId);
  return info;
}

const { Affiliation, User, Tree, Token, Transaction, Office, Closed } = db;
const { error, success, midd, ids, parent_ids, map, model, rand } = lib;

const A = [
  "id",
  "date",
  "plan",
  "voucher",
  "voucher2",
  "status",
  "office",
  "delivered",
  "pay_method",
  "bank",
  "voucher_date",
  "voucher_number",
  "amounts",
  "products",
  "transactions", // Asegúrate de que este campo esté en tu modelo
  "type", // NUEVO: mostrar tipo de afiliación
  "previousPlan", // NUEVO: mostrar plan anterior si es upgrade
  "difference", // NUEVO: mostrar diferencia si es upgrade
];
const U = ["name", "lastName", "dni", "phone"];

let users = null;
let tree = null;

// Definición de pagos fijos por plan y nivel. Cada array tiene 9 valores (uno por cada nivel de profundidad).

const pay = {
  basic: [90, 20, 5, 3, 3, 1.5, 1.5, 1.5, 1.5], // Solo absorbe 3 niveles
  standard: [300, 50, 20, 10, 10, 5, 5, 5, 5], // Solo absorbe 6 niveles
  master: [500, 100, 60, 40, 20, 10, 10, 10, 10], // Absorbe los 9 niveles
};

// Define cuántos niveles puede absorber cada plan
const absorb_levels = {
  basic: 3, // Solo recibe pagos de los primeros 3 niveles
  standard: 6, // Solo recibe pagos de los primeros 6 niveles
  master: 9, // Recibe pagos de los 9 niveles
};

let pays = [];

// Función para repartir bonos de afiliación hasta 9 niveles hacia arriba,
async function pay_bonus(
  id,
  i,
  aff_id,
  amount,
  migration,
  plan_afiliado,
  _id,
  previousPlan = null
) {
  const user = users.find((e) => e.id == id);
  const node = tree.find((e) => e.id == id);

  // Si el usuario no existe, termina la recursión
  if (!user) return;

  const virtual = user._activated || user.activated ? false : true;
  const name = migration ? "migration bonus" : "affiliation bonus";

  // Si es upgrade (previousPlan existe), pagar solo la diferencia por nivel
  let fixed_payment;
  if (previousPlan) {
    const nuevo = pay[plan_afiliado][i] || 0;
    const anterior = pay[previousPlan][i] || 0;
    fixed_payment = nuevo - anterior;
  } else {
    fixed_payment = pay[plan_afiliado][i];
  }

  // Solo paga si el usuario puede absorber este nivel según su plan y la diferencia es positiva
  if (i < absorb_levels[user.plan] && fixed_payment && fixed_payment > 0) {
    const transactionId = rand();
    await Transaction.insert({
      id: transactionId,
      date: new Date(),
      user_id: user.id,
      type: "in",
      value: fixed_payment, // Pago fijo o diferencia
      name,
      affiliation_id: aff_id,
      virtual,
      _user_id: _id,
    });
    pays.push(transactionId);
  }

  // Siempre reparte hasta 9 niveles hacia arriba (i = 0 a 8)
  if (i == 8 || !node.parent) return;
  await pay_bonus(
    node.parent,
    i + 1,
    aff_id,
    amount,
    migration,
    plan_afiliado,
    _id,
    previousPlan
  );
}

const handler = async (req, res) => {
  if (req.method == "GET") {
    // Obtener parámetros de paginación
    const { filter, page = 1, limit = 20, search } = req.query;
    console.log(
      "Received request with page:",
      page,
      "and limit:",
      limit,
      "search:",
      search
    );

    // Convertir a números
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const q = {
      all: {},
      pending: { status: "pending" },
      approved: { status: "approved" },
    };

    if (!(filter in q)) return res.json(error("invalid filter"));

    const { account } = req.query;

    // get AFFILIATIONS
    let qq = q[filter];

    if (account != "admin") qq.office = account;
    try {
      // Primero obtener todas las afiliaciones que coinciden con el filtro
      let allAffiliations = await Affiliation.find(qq);

      // get USERS for affiliations
      users = await User.find({});
      users = map(users);

      // Apply search if search parameter exists
      if (search) {
        const searchLower = search.toLowerCase();
        allAffiliations = allAffiliations.filter((aff) => {
          const user = users.get(aff.userId);
          return (
            user &&
            (user.name?.toLowerCase().includes(searchLower) ||
              user.lastName?.toLowerCase().includes(searchLower) ||
              user.dni?.toLowerCase().includes(searchLower) ||
              user.phone?.toLowerCase().includes(searchLower))
          );
        });
      }

      // Ordenar manualmente por fecha (del más reciente al más antiguo)
      allAffiliations.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Obtener el total antes de paginar
      const totalAffiliations = allAffiliations.length;

      // Aplicar paginación manualmente
      let affiliations = allAffiliations.slice(
        (pageNum - 1) * limitNum,
        pageNum * limitNum
      );

      // Obtener solo los usuarios necesarios para las afiliaciones paginadas
      users = await User.find({ id: { $in: ids(affiliations) } });
      users = map(users);

      // enrich affiliations
      affiliations = affiliations.map((a) => {
        let u = users.get(a.userId);
        a = model(a, A);
        u = model(u, U);
        return { ...a, ...u };
      });

      let parents = await User.find({ id: { $in: parent_ids(affiliations) } });

      // Devolver los resultados con información de paginación
      return res.json(
        success({
          affiliations,
          total: totalAffiliations,
          totalPages: Math.ceil(totalAffiliations / limitNum),
          currentPage: pageNum,
        })
      );
    } catch (err) {
      console.error("Database error:", err);
      return res.status(500).json(error("Database error"));
    }
  }

  if (req.method == "POST") {
    const { id, action } = req.body;

    // get affiliation
    let affiliation = await Affiliation.findOne({ id });

    // validate affiliation
    if (!affiliation) return res.json(error("affiliation not exist"));

    if (action == "approve" || action == "reject") {
      if (affiliation.status == "approved")
        return res.json(error("already approved"));
      if (affiliation.status == "rejected")
        return res.json(error("already rejected"));
    }

    if (action == "approve") {
      // approve AFFILIATION
      // Marcar delivered como false para nuevas aprobaciones (control manual)
      await Affiliation.update({ id }, { status: "approved", delivered: false });

      // update USER
      const user = await User.findOne({ id: affiliation.userId });

      // Si es upgrade, solo actualizar lo necesario
      if (affiliation.type === "upgrade") {
        // Actualizar plan y puntos (sumar solo la diferencia)
        const currentAffiliationPoints = user.affiliation_points || 0;
        const newAffiliationPoints = currentAffiliationPoints + (affiliation.difference?.points || 0);
        
        await User.update(
          { id: user.id },
          {
            plan: affiliation.plan.id,
            n: affiliation.plan.n,
            affiliation_points: newAffiliationPoints,
            affiliation_date: new Date(),
            _activated: true,
            activated:true
          }
        );
        // CRÍTICO: Actualizar total_points después del upgrade
        await lib.updateTotalPointsCascade(User, Tree, user.id);
        // PAGAR BONOS SOLO SOBRE LA DIFERENCIA
        tree = await Tree.find({});
        users = await User.find({});
        pays = [];
        const plan = affiliation.plan.id;
        const previousPlan = affiliation.previousPlan?.id; // <-- Tomar solo el id del plan anterior
        const amount = affiliation.difference?.amount || 0;
        // Solo repartir bonos si hay diferencia positiva
        if (amount > 0) {
          await pay_bonus(
            user.parentId,
            0,
            affiliation.id,
            amount,
            false,
            plan,
            user.id,
            previousPlan // <-- Pasar el plan anterior
          );
        }
        // Actualizar la afiliación con las transacciones
        await Affiliation.update({ id }, { transactions: pays });
        // UPDATE STOCK SOLO DE PRODUCTOS ADICIONALES
        const office_id = affiliation.office;
        const diffProducts = affiliation.difference?.products || [];
        const office = await Office.findOne({ id: office_id });
        diffProducts.forEach((p, i) => {
          if (office.products[i]) office.products[i].total -= p.total;
        });
        await Office.update(
          { id: office_id },
          {
            products: office.products,
          }
        );
        // migrar transacciones virtuales solo las que fueron creadas después del último cierre
        // y que NO sean transacciones "closed reset" (compensaciones de cierre)
        // y que NO sean transacciones que ya fueron compensadas por "closed reset"
        // Primero obtener la fecha del último cierre
        const lastClosed = await Closed.findOne({}, { sort: { date: -1 } });
        
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
        const allVirtualTransactions = await Transaction.find({
          user_id: user.id,
          virtual: true,
          name: { $ne: "closed reset" }
        }).sort({ date: 1 }); // Ordenar por fecha (más antiguas primero)
        
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
          await Transaction.update({ id: transaction.id }, { virtual: false });
        }

        // Enviar email de bienvenida SIFRAH al aprobar upgrade
        console.log('[Affiliations] Usuario email para notificacion (upgrade):', user.email);
        try {
          if (user.email) {
            await sendSifrahWelcomeEmail({
              email: user.email,
              name: user.name,
              lastName: user.lastName || '',
              dni: user.dni || ''
            });
          } else {
            console.warn('[Affiliations] Usuario no tiene email registrado, no se envia notificacion (upgrade). userId:', user.id);
          }
        } catch (emailError) {
          console.error('[Affiliations] Error enviando email SIFRAH (upgrade):', emailError.message);
        }

        return res.json(success());
      }

      await User.update(
        { id: user.id },
        {
          affiliated: true,
          _activated: true,
          activated: true,
          affiliation_date: new Date(),
          plan: affiliation.plan.id,
          n: affiliation.plan.n,
          affiliation_points: affiliation.plan.affiliation_points,
        }
      );
      // CRÍTICO: Actualizar total_points después de la afiliación
      await lib.updateTotalPointsCascade(User, Tree, user.id);

      if (!user.tree) {
        // Generate a unique token dynamically
        let token = null;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!token && attempts < maxAttempts) {
          const generatedToken = lib.generateToken();
          const existingToken = await User.findOne({ token: generatedToken });
          if (!existingToken) {
            token = generatedToken;
          }
          attempts++;
        }
        
        if (!token) {
          return res.json(error('unable to generate unique token'));
        }

        // insert to tree
        // Usar parent.id directamente (ya no se usa apalancamiento/coverage)
        // Si el parent tiene coverage, usar ese ID; si no, usar parent.id
        const parent = await User.findOne({ id: user.parentId });
        const _id = parent.coverage?.id || parent.id;
        let node = await Tree.findOne({ id: _id });

        node.childs.push(user.id);

        await Tree.update({ id: _id }, { childs: node.childs });
        await Tree.insert({ id: user.id, childs: [], parent: _id });

        // update USER
        await User.update(
          { id: user.id },
          {
            tree: true,
            token: token,
          }
        );
      }

      // PAY AFFILIATION BONUS
      tree = await Tree.find({});
      users = await User.find({});
      pays = [];

      const plan = affiliation.plan.id;
      const amount = affiliation.plan.amount - 50;

      if (user.plan == "default") {
        await pay_bonus(
          user.parentId,
          0,
          affiliation.id,
          amount,
          false,
          plan,
          user.id
        );
      } else {
        await pay_bonus(
          user.parentId,
          0,
          affiliation.id,
          amount,
          true,
          plan,
          user.id
        );
      }

      // Actualizar la afiliación con las transacciones
      await Affiliation.update({ id }, { transactions: pays }); // Aquí se agregan las IDs de las transacciones

      // UPDATE STOCK
      const office_id = affiliation.office;
      const products = affiliation.products;

      const office = await Office.findOne({ id: office_id });

      products.forEach((p, i) => {
        if (office.products[i]) office.products[i].total -= products[i].total;
      });

      await Office.update(
        { id: office_id },
        {
          products: office.products,
        }
      );

      // migrar transacciones virtuales solo las que fueron creadas después del último cierre
      // y que NO sean transacciones "closed reset" (compensaciones de cierre)
      // y que NO sean transacciones que ya fueron compensadas por "closed reset"
      const lastClosed = await Closed.findOne({}, { sort: { date: -1 } });
      
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
      const allVirtualTransactions = await Transaction.find({
        user_id: user.id,
        virtual: true,
        name: { $ne: "closed reset" }
      }).sort({ date: 1 }); // Ordenar por fecha (más antiguas primero)
      
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

      // Enviar email de bienvenida SIFRAH al aprobar primera afiliacion
      console.log('[Affiliations] Usuario email para notificacion:', user.email);
      try {
        if (user.email) {
          await sendSifrahWelcomeEmail({
            email: user.email,
            name: user.name,
            lastName: user.lastName || '',
            dni: user.dni || ''
          });
        } else {
          console.warn('[Affiliations] Usuario no tiene email registrado, no se envia notificacion. userId:', user.id);
        }
      } catch (emailError) {
        console.error('[Affiliations] Error enviando email SIFRAH:', emailError.message, emailError.stack);
      }
    }

    if (action == "reject") {
      await Affiliation.update({ id }, { status: "rejected" });

      // revert transactions
      if (affiliation.transactions) {
        for (let transactionId of affiliation.transactions) {
          await Transaction.delete({ id: transactionId });
        }
      }
    }

    if (action == "check") {
      await Affiliation.update({ id }, { delivered: true });
    }

    if (action == "uncheck") {
      await Affiliation.update({ id }, { delivered: false });
    }

    if (action == "revert") {
      console.log("revert");

      const user = await User.findOne({ id: affiliation.userId });

      await Affiliation.delete({ id });

      const transactions = affiliation.transactions;
      console.log(transactions);

      for (let id of transactions) {
        await Transaction.delete({ id });
      }

      const affiliations = await Affiliation.find({
        userId: user.id,
        status: "approved",
      });

      if (affiliations.length) {
        affiliation = affiliations[affiliations.length - 1];

        await User.update(
          { id: user.id },
          {
            // affiliated: false,
            _activated: false,
            activated: false,
            plan: affiliation.plan.id,
            affiliation_date: affiliation.date,
            affiliation_points: affiliation.plan.affiliation_points,
            n: affiliation.plan.n,
          }
        );
      } else {
        await User.update(
          { id: user.id },
          {
            affiliated: false,
            _activated: false,
            activated: false,
            plan: "default",
            affiliation_date: null,
            affiliation_points: 0,
            n: 0,
          }
        );
      }

      // UPDATE STOCK
      console.log("UPDATE STOCK ...");
      const office_id = affiliation.office;
      const products = affiliation.products;

      const office = await Office.findOne({ id: office_id });

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

    return res.json(success());
  }
};

export default async (req, res) => {
  await midd(req, res);
  return handler(req, res);
};