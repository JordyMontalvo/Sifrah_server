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

const {
  Affiliation,
  User,
  Tree,
  Token,
  Transaction,
  Office,
  Closed,
  Period,
  Activation,
} = db;
const { error, success, midd, ids, parent_ids, map, model, rand } = lib;

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
  "use_balance",
  "products",
  "transactions",
  "type",
  "period_key",    // Periodo al momento de aprobación
  "period_label",  // Label del periodo al momento de aprobación
  "approved_at",   // Fecha y hora exacta de aprobación
];
const U = ["name", "lastName", "dni", "phone"];

let users = null;
let tree = null;

// Definición de pagos fijos por plan y nivel. Cada array tiene 9 valores (uno por cada nivel de profundidad).

const pay = {
  basic: [90, 10, 10, 5, 5, 1, 1, 1, 1],      // Ejecutivo
  standard: [300, 50, 20, 10, 10, 5, 5, 5, 5], // Distribuidor
  master: [500, 100, 100, 50, 50, 10, 10, 10, 10], // Empresario
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
  _id
) {
  const user = users.find((e) => e.id == id);
  const node = tree.find((e) => e.id == id);

  // Si el usuario no existe, termina la recursión
  if (!user) return;

  const virtual = user._activated || user.activated ? false : true;
  const name = migration ? "migration bonus" : "affiliation bonus";

  const fixed_payment = pay[plan_afiliado][i];

  // Solo paga si el usuario puede absorber este nivel y hay pago definido
  if (i < absorb_levels[user.plan] && fixed_payment && fixed_payment > 0) {
    const transactionId = rand();
    await Transaction.insert({
      id: transactionId,
      date: new Date(),
      user_id: user.id,
      type: "in",
      value: fixed_payment,
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
    _id
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
        // amounts: [paid_virtual, paid_balance, due_or_external]
        const amounts = Array.isArray(a.amounts) && a.amounts.length >= 3 ? a.amounts : null;
        const planAmt = a.plan && a.plan.amount != null ? Number(a.plan.amount) : 0;
        let paid_virtual = 0;
        let paid_balance = 0;
        let due = 0;
        let legacy_missing_amounts = false;

        if (amounts) {
          paid_virtual = Number(amounts[0] || 0);
          paid_balance = Number(amounts[1] || 0);
          due = Number(amounts[2] || 0);
        } else {
          // Registros viejos sin `amounts` o incompletos
          if (a.use_balance === true) {
            legacy_missing_amounts = true;
            paid_virtual = 0;
            paid_balance = 0;
            due = 0;
          } else {
            // Sin casilla de saldo o sin dato: se asume pago 100% por método externo (voucher/banco/etc.)
            paid_virtual = 0;
            paid_balance = 0;
            due = planAmt;
          }
        }

        const total =
          planAmt || paid_virtual + paid_balance + due;

        let mode = "external_only";
        if (a.use_balance === true) {
          if (due <= 0.0001) mode = "balance_only";
          else mode = "mixed";
        } else if (amounts && (paid_virtual > 0 || paid_balance > 0)) {
          // Registros antiguos sin use_balance guardado pero con amounts (p. ej. solo saldo o mixto)
          if (due <= 0.0001) mode = "balance_only";
          else mode = "mixed";
        }

        return {
          ...a,
          ...u,
          payment_breakdown: {
            total,
            paid_virtual,
            paid_balance,
            due,
            legacy_missing_amounts,
            mode,
            use_balance: !!a.use_balance,
          },
        };
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
      // Validar duplicado de voucher antes de proceder
      if (affiliation.pay_method === "bank" && affiliation.voucher_number) {
        const vn = String(affiliation.voucher_number).trim();
        const dupAct = await Activation.findOne({
          voucher_number: vn,
          status: "approved",
        });
        const dupAff = await Affiliation.findOne({
          voucher_number: vn,
          status: "approved",
          id: { $ne: id },
        });

        if (dupAct || dupAff) {
          return res.json(
            error(
              `El número de operación "${vn}" ya ha sido utilizado en otro pago aprobado.`
            )
          );
        }
      }

      // approve AFFILIATION - Sin lógica de upgrade
      const approvedAt = new Date();
      const resolvedPeriod = await resolvePeriodAtApproval(approvedAt);
      const approvedPeriodKey   = resolvedPeriod ? resolvedPeriod.key   : (affiliation.period_key   || null);
      const approvedPeriodLabel = resolvedPeriod ? resolvedPeriod.label : (affiliation.period_label || null);

      console.log('[Approve Affiliation] approved_at:', approvedAt, '| periodo resuelto:', approvedPeriodKey);

      // Marcar como aprobada
      await Affiliation.update({ id }, {
        status: "approved",
        delivered: false,
        approved_at: approvedAt,
        period_key: approvedPeriodKey,
        period_label: approvedPeriodLabel,
      });

      // update USER
      const user = await User.findOne({ id: affiliation.userId });

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

      // CRÍTICO: Actualizar total_points
      await lib.updateTotalPointsCascade(User, Tree, user.id);

      // PAGO DE BONOS (siempre al 100%)
      tree = await Tree.find({});
      users = await User.find({});
      pays = [];
      const plan = affiliation.plan.id;
      const amount = affiliation.plan.amount - 50;

      await pay_bonus(
        user.parentId,
        0,
        affiliation.id,
        amount,
        false,
        plan,
        user.id
      );

      // Guardar transacciones de bonos
      await Affiliation.update({ id }, { transactions: pays });

      // UPDATE STOCK
      const office_id = affiliation.office;
      const products = affiliation.products;
      const office = await Office.findOne({ id: office_id });

      products.forEach((p, i) => {
        if (office.products[i]) office.products[i].total -= products[i].total;
      });

      await Office.update({ id: office_id }, { products: office.products });

      // Migrar transacciones virtuales
      const lastClosed = await Closed.findOne({}, { sort: { date: -1 } });
      let virtualTransactionsQuery = {
        user_id: user.id,
        virtual: true,
        name: { $ne: "closed reset" }
      };
      
      if (lastClosed) {
        virtualTransactionsQuery.date = { $gte: lastClosed.date };
      }
      
      const virtualTxs = await Transaction.find(virtualTransactionsQuery);
      for (let tx of virtualTxs) {
        await Transaction.update({ id: tx.id }, { virtual: false });
      }

      // Enviar email de bienvenida
      console.log('[Affiliations] Usuario email para notificacion:', user.email);
      try {
        if (user.email) {
          await sendSifrahWelcomeEmail({
            email: user.email,
            name: user.name,
            lastName: user.lastName || '',
            dni: user.dni || ''
          });
        }
      } catch (emailError) {
        console.error('[Affiliations] Error enviando email SIFRAH:', emailError.message);
      }

      return res.json(success());
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

    if (action == "cancel") {
      // Marcar como anulada. Si estaba aprobada, revertir efectos (usuario/stock/bonos).
      if (affiliation.status == "cancelled") {
        return res.json(error("already cancelled"));
      }

      const wasApproved = affiliation.status === "approved";
      await Affiliation.update(
        { id },
        {
          status: "cancelled",
          cancelled_at: new Date(),
        }
      );

      if (wasApproved) {
        const user = await User.findOne({ id: affiliation.userId });

        // Revertir BONOS: en approve() se guarda `transactions: pays` (ids de bonos)
        if (affiliation.transactions && affiliation.transactions.length) {
          for (let transactionId of affiliation.transactions) {
            await Transaction.delete({ id: transactionId });
          }
        }

        // Revertir STOCK: al aprobar se descontó, al anular se devuelve
        const office_id = affiliation.office;
        const products = affiliation.products || [];
        const office = await Office.findOne({ id: office_id });
        if (office && office.products && products.length) {
          products.forEach((p, i) => {
            if (office.products[i]) office.products[i].total += products[i].total;
          });
          await Office.update({ id: office_id }, { products: office.products });
        }

        // Revertir estado del USUARIO: volver a la última afiliación aprobada (excluyendo esta)
        const prevApproved = await Affiliation.findOne(
          { userId: user.id, status: "approved", id: { $ne: affiliation.id } },
          { sort: { date: -1 } }
        );

        if (prevApproved) {
          await User.update(
            { id: user.id },
            {
              affiliated: true,
              _activated: true,
              activated: true,
              plan: prevApproved.plan.id,
              n: prevApproved.plan.n,
              affiliation_points: prevApproved.plan.affiliation_points,
              affiliation_date: prevApproved.date,
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
              n: 0,
              affiliation_points: 0,
              affiliation_date: null,
            }
          );
        }

        // Recalcular total_points
        await lib.updateTotalPointsCascade(User, Tree, user.id);
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