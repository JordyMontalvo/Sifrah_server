import db from "../../../components/db"
import lib from "../../../components/lib"
import {
  mainCatalogMongoFilter,
  savingsCatalogMongoFilter,
  findSavingsOnlyInOrder,
  isPromotionProduct,
} from "../../../lib/productCatalog"
import {
  countPromotionPurchasedByUser,
  enrichPromotionForStore,
  validatePromotionOrder,
} from "../../../lib/promotionStock"
import { sortProducts } from "../../../lib/productSort"

const { User, Session, Product, Activation, Affiliation, Office, Transaction } = db
const { error, success, midd, map, rand, acum } = lib

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

/**
 * Obtiene el periodo abierto actual o crea uno nuevo.
 * 
 * IMPORTANTE: Esta función asigna el periodo ABIERTO en el momento de la compra,
 * no el periodo del mes de la fecha. Esto permite que:
 * - Un periodo puede iniciarse en cualquier fecha (ej: 2 de enero)
 * - Ese periodo puede cerrarse en cualquier fecha posterior (ej: 3 de febrero)
 * - Todas las compras entre el inicio y el cierre pertenecen a ese periodo,
 *   sin importar que se hayan hecho en un mes diferente
 * 
 * Ejemplo:
 * - Periodo "Enero 2025" iniciado el 2 de enero, cerrado el 3 de febrero
 * - Todas las compras del 2 de enero al 3 de febrero pertenecen a "Enero 2025"
 * - Incluso las compras del 1-3 de febrero pertenecen a "Enero 2025" (hasta que se cierre)
 */
async function getOrCreateOpenPeriod(Period, now = new Date()) {
  // Buscar todos los periodos abiertos
  const openPeriods = await Period.find({ status: "open" });

  // Si hay periodos abiertos, usar el más reciente (por fecha de creación)
  // Esto asegura que se use el periodo que está actualmente activo
  if (openPeriods && openPeriods.length) {
    openPeriods.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return openPeriods[0];
  }

  // Si no hay periodos abiertos, crear uno nuevo del mes actual
  // Esto solo debería pasar si es la primera vez que se usa el sistema
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const key = buildPeriodKey(year, month);

  // Verificar si ya existe un periodo con esa key (puede estar cerrado)
  const existing = await Period.findOne({ key });
  if (existing && existing.status !== "closed") return existing;

  // Crear nuevo periodo
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
  await midd(req, res)

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if (!session) return res.json(error('invalid session'))

  // check verified
  const user = await User.findOne({ id: session.id })
  console.log(user.plan)

  // get plans
  const isSavingsBonusFilter = req.query.type === 'savings_bonus'

  const productFilter = isSavingsBonusFilter
    ? savingsCatalogMongoFilter()
    : mainCatalogMongoFilter()

  const userCanSeePromotions = !!(user.activated || user._activated);

  let _products = await Product.find(productFilter);

  if (!isSavingsBonusFilter) {
    const promoDocs = await Product.find({
      $or: [
        { is_promotion: true },
        { catalog_type: "promotion" },
        { type: "Promoción" },
      ],
    });

    const byId = new Map(_products.map((p) => [String(p.id), p]));

    if (userCanSeePromotions) {
      for (const promo of promoDocs) {
        if (promo.promotion_active === false) continue;
        byId.set(String(promo.id), promo);
      }
    }

    _products = Array.from(byId.values());

    if (!userCanSeePromotions) {
      _products = _products.filter((p) => !isPromotionProduct(p));
    } else {
      _products = _products.filter((p) => {
        if (!isPromotionProduct(p)) return true;
        return p.promotion_active !== false;
      });
    }

    const enriched = [];
    for (const p of _products) {
      if (isPromotionProduct(p)) {
        const purchased = await countPromotionPurchasedByUser(
          p.id,
          user.id,
          Activation
        );
        const enrichedP = enrichPromotionForStore(p, purchased);
        const max = Number(p.available_quantity) || 0;
        if (max > 0 && enrichedP.promotion_remaining === 0) {
          continue;
        }
        enriched.push(enrichedP);
      } else {
        enriched.push(p);
      }
    }
    _products = enriched;
  }

  _products = sortProducts(_products);



  // let i

  // if(user.plan == 'basic')    i = 0
  // if(user.plan == 'standard') i = 1
  // if(user.plan == 'business') i = 2
  // if(user.plan == 'master')   i = 3
  // console.log({i})

  // _products.forEach(p => {
  //   const price = p.price
  //   console.log(p.name)
  //   console.log(p.price)
  //   console.log('')

  //   p.price = p.price[i]
  // })

  const profit = user.profit ? user.profit : 0


  // get transactions
  const transactions = await Transaction.find({ user_id: user.id, virtual: { $in: [null, false] } })
  const _transactions = await Transaction.find({ user_id: user.id, virtual: true })

  const _ins = acum(_transactions, { type: 'in' }, 'value')
  const _outs = acum(_transactions, { type: 'out' }, 'value')

  const balance = lib.calcAvailableBalance(transactions)
  const _balance = _ins - _outs



  if (req.method == 'GET') {

    const offices = await Office.find({ active: { $ne: false } })// Usuarios solo ven oficinas activas
    console.log("[Activation API] Oficinas cargadas:", offices.map(o => ({
      id: o.id,
      name: o.name,
      address: o.address,
      horario: o.horario,
      dias: o.dias,
      accounts: o.accounts
    })));

    // response
    return res.json(success({
      name: user.name,
      lastName: user.lastName,
      dni: user.dni,
      affiliated: user.affiliated,
      activated: user.activated,
      _activated: user._activated,
      plan: user.plan,
      country: user.country,
      photo: user.photo,
      tree: user.tree,

      products: _products,
      points: user.points,
      profit,
      offices,

      balance,
      _balance,
    }))
  }

  if (req.method == 'POST') {

    let { products, office, check, voucher, voucher2, pay_method, bank, bank_info, date, voucher_number, voucher_number2, deliveryMethod, deliveryInfo, transaction_id, authorization_code } = req.body;
    const useCheck = check === true || check === "true";

    if (!Array.isArray(products) || !products.length) {
      return res.json(error("No hay productos en la orden."));
    }

    const productIds = products.map((p) => String(p.id));
    const dbProducts = await Product.find({ id: { $in: productIds } });
    const catalogById = new Map(dbProducts.map((p) => [String(p.id), p]));
    const savingsOnly = findSavingsOnlyInOrder(products, catalogById);
    if (savingsOnly) {
      return res.json(
        error(
          `El producto "${savingsOnly.name}" solo está disponible en Tienda Bono Ahorro.`
        )
      );
    }

    const hasPromotion = products.some((p) => {
      const db = catalogById.get(String(p.id));
      return db && isPromotionProduct(db);
    });
    if (hasPromotion && !userCanSeePromotions) {
      return res.json(
        error("Las promociones solo están disponibles para usuarios activos.")
      );
    }

    const stockError = await validatePromotionOrder(
      products,
      catalogById,
      Activation,
      user.id
    );
    if (stockError) {
      return res.json(error(stockError.error));
    }

    // Cada comprobante debe tener su propio número de operación
    if (pay_method === 'bank' && voucher2 && !voucher_number2) {
      return res.json(error('Falta el número de operación del segundo comprobante de pago.'));
    }

    // Validación de duplicidad de voucher (incluye ambos números de operación)
    if (pay_method === 'bank') {
      const numbers = [voucher_number, voucher_number2]
        .filter((n) => n != null && String(n).trim() !== '')
        .map((n) => String(n).trim());

      // No permitir el mismo número repetido en la misma orden
      if (numbers.length === 2 && numbers[0] === numbers[1]) {
        return res.json(error('Los dos comprobantes no pueden tener el mismo número de operación.'));
      }

      for (const vn of numbers) {
        const dupAct = await Activation.findOne({ $or: [{ voucher_number: vn }, { voucher_number2: vn }], status: { $in: ['approved', 'pending'] } });
        const dupAff = await Affiliation.findOne({ $or: [{ voucher_number: vn }, { voucher_number2: vn }], status: { $in: ['approved', 'pending'] } });
        if (dupAct || dupAff) {
          return res.json(error(`El número de operación "${vn}" ya ha sido registrado previamente. Por favor, verifica los datos.`));
        }
      }
    }

    console.log('Activation POST - voucher:', voucher ? 'existe' : 'null');
    console.log('Activation POST - voucher2:', voucher2 ? voucher2 : 'null');

    // Validación obligatoria: Oficina de recojo (PDE) cuando el método es pickup
    // Esto evita que se pueda "saltarse" el frontend enviando officeId vacío.
    if ((deliveryMethod || 'pickup') === 'pickup') {
      const officeId = deliveryInfo && deliveryInfo.officeId ? String(deliveryInfo.officeId).trim() : ''
      if (!officeId) return res.json(error('Selecciona una Oficina de Recojo (PDE).'))

      const officeDoc = await Office.findOne({ id: officeId, active: { $ne: false } })
      if (!officeDoc) return res.json(error('La Oficina de Recojo (PDE) seleccionada no es válida.'))
    }

    let agencyName = '';
    if (deliveryMethod === 'delivery' && deliveryInfo && deliveryInfo.department !== 'lima' && deliveryInfo.agency) {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
      const db = client.db();
      const selectedAgency = await db.collection('delivery_agencies').findOne({ agency_code: deliveryInfo.agency });
      await client.close();
      if (selectedAgency) {
        agencyName = selectedAgency.agency_name;
      }
    }

    // Obtener el plan del usuario
    const planId = user.plan && user.plan.id ? user.plan.id : user.plan;

    // Recalcular el precio de cada producto según el plan del usuario
    products = products.map((p) => {
      let finalPrice = p.price;
      if (p.prices && planId && p.prices[planId] != null && p.prices[planId] !== "") {
        finalPrice = p.prices[planId];
      }
      const dbProduct = catalogById.get(String(p.id));
      const promoPoints =
        dbProduct && isPromotionProduct(dbProduct) ? 0 : p.points || 0;
      return { ...p, price: finalPrice, points: promoPoints };
    });

    const points = products.reduce((a, b) => a + (b.points || 0) * b.total, 0)
    // const points = products.reduce((a, b) => a + (b.val ? b.val : b.price) * b.total, 0)

    const total = products.reduce((a, b) => a + b.total, 0)
    // const _total = products.reduce((a, b) => a + (b.desc ? b.total : 0), 0)
    // console.log({ _total })

    let price = products.reduce((a, b) => a + b.price * b.total, 0)
    // Incluir delivery en el monto a cobrar (debe coincidir con checkout finalTotal)
    let deliveryCharge = 0;
    if (deliveryMethod === "delivery" && deliveryInfo) {
      deliveryCharge = Number(deliveryInfo.deliveryPrice) || 0;
    }
    price = price + deliveryCharge;

    // let __total = _total
    // if(__total % 2) {
    //   console.log('impar')
    //   __total -= 1
    // }
    // let desc = __total / 2 * 10
    // console.log({ desc })
    // price = price - desc

    let transactions = []
    let amounts

    const { Period } = db
    const period = await getOrCreateOpenPeriod(Period, new Date())

    if (useCheck) {

      const a = _balance < price ? _balance : price
      const r = (price - _balance) > 0 ? price - _balance : 0
      const b = balance < r ? balance : r
      const c = price - a - b
      // console.log({ a, b, c })
      const id1 = rand()
      const id2 = rand()

      amounts = [a, b, c]

      if (a) {
        transactions.push(id1)

        await Transaction.insert({
          id: id1,
          date: new Date(),
          user_id: user.id,
          type: 'out',
          value: a,
          name: 'activation',
          virtual: true,
          period_key: period.key,
          period_label: period.label,
        })
      }

      if (b) {
        transactions.push(id2)

        await Transaction.insert({
          id: id2,
          date: new Date(),
          user_id: user.id,
          type: 'out',
          value: b,
          name: 'activation',
          virtual: false,
          period_key: period.key,
          period_label: period.label,
        })
      }
    }

    // save new activation
    const activationId = rand();
    await Activation.insert({
      id: activationId,
      date: new Date(),
      userId: user.id,
      products,
      price,
      points,
      total,
      period_key: period.key,
      period_label: period.label,
      // _total,
      check: useCheck,
      voucher,
      voucher2,
      transactions,
      amounts,
      // Se usará deliveryInfo.officeId si es 'pickup' (validado arriba)
      office: req.body.deliveryMethod === 'pickup' ? req.body.deliveryInfo.officeId : null,
      status: 'pending',
      delivered: false,

      pay_method,
      bank,
      bank_info,
      voucher_date: date,
      voucher_number,
      voucher_number2: voucher_number2 || null,
      transaction_id: req.body.transaction_id,
      authorization_code: req.body.authorization_code || null,

      //  CAMPOS DE DELIVERY CORREGIDOS
      delivery_info: {
        method: req.body.deliveryMethod || 'pickup', // 'delivery' o 'pickup'
        has_delivery: req.body.deliveryMethod === 'delivery',

        // Datos del receptor (solo si es delivery)
        ...(req.body.deliveryMethod === 'delivery' && req.body.deliveryInfo && {
          recipient_name: req.body.deliveryInfo.recipientName,
          recipient_document: req.body.deliveryInfo.document,
          recipient_phone: req.body.deliveryInfo.recipientPhone,

          // Información de ubicación
          location: {
            department: req.body.deliveryInfo.department,
            province: req.body.deliveryInfo.province,
            district: req.body.deliveryInfo.district,
          },

          // 🔥 NUEVO: Precio del delivery (siempre presente)
          delivery_price: req.body.deliveryInfo.deliveryPrice || 0,
          delivery_type: req.body.deliveryInfo.deliveryType || 'unknown',

          // Para Lima (zonas) - usando deliveryZone que enviamos desde el frontend
          ...(req.body.deliveryInfo.deliveryZone && {
            zone_info: {
              zone_name: req.body.deliveryInfo.deliveryZone.zone_name,
              zone_id: req.body.deliveryInfo.deliveryZone.zone_id,
              zone_price: req.body.deliveryInfo.deliveryZone.price
            }
          }),

          // Para Provincias (agencias)
          ...(req.body.deliveryInfo.agency && {
            agency_info: {
              agency_name: agencyName || '',
              agency_code: req.body.deliveryInfo.agency
            }
          }),

          // Notas de delivery
          delivery_notes: req.body.deliveryInfo.deliveryNote || '',

          // Dirección de entrega (opcional)
          delivery_address: req.body.deliveryInfo.address || ''
        })
      }
    })

    // response (orderNumber para el checkout y trazabilidad)
    return res.json(success({ orderNumber: activationId, id: activationId }))
  }
}
