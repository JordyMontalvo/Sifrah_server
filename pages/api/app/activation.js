import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Product, Activation, Office, Transaction } = db
const { error, success, midd, map, rand, acum } = lib


export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // check verified
  const user = await User.findOne({ id: session.id })
  console.log(user.plan)

  // get plans
  let _products = await Product.find({})

  if(!user.activated) {
    _products = _products.filter((p) => p.type != 'Promoción')
  }



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
  const  transactions = await Transaction.find({ user_id: user.id, virtual: {$in: [null, false]} })
  const _transactions = await Transaction.find({ user_id: user.id, virtual:              true    })

  const  ins  = acum( transactions, {type: 'in' }, 'value')
  const  outs = acum( transactions, {type: 'out'}, 'value')
  const _ins  = acum(_transactions, {type: 'in' }, 'value')
  const _outs = acum(_transactions, {type: 'out'}, 'value')

  const  balance =  ins -  outs
  const _balance = _ins - _outs



  if(req.method == 'GET') {

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
      name:       user.name,
      lastName:   user.lastName,
      affiliated: user.affiliated,
      activated:  user.activated,
     _activated:  user._activated,
      plan:       user.plan,
      country:    user.country,
      photo:      user.photo,
      tree:       user.tree,
      
      products:  _products,
      points:     user.points,
      profit,
      offices,

      balance,
     _balance,
    }))
  }

  if(req.method == 'POST') {

    let { products, office, check, voucher, voucher2, pay_method, bank, bank_info, date, voucher_number, deliveryMethod, deliveryInfo } = req.body;
    
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
      let finalPrice = p.price; // Usar el precio inicial del producto
      if (p.prices && planId && p.prices[planId] != null && p.prices[planId] !== "") {
        finalPrice = p.prices[planId];
      }
      // Retornar todas las propiedades del producto y actualizar solo el precio
      return { ...p, price: finalPrice };
    });

    const points = products.reduce((a, b) => a + b.points * b.total, 0)
    // const points = products.reduce((a, b) => a + (b.val ? b.val : b.price) * b.total, 0)

    const total  = products.reduce((a, b) => a + b.total, 0)
    // const _total = products.reduce((a, b) => a + (b.desc ? b.total : 0), 0)
    // console.log({ _total })

    let price = products.reduce((a, b) => a + b.price * b.total, 0)

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

    if(check) {

      const a = _balance < price ? _balance : price
      const r = (price - _balance) > 0 ? price - _balance : 0
      const b = balance < r ? balance : r
      const c = price - a - b
      // console.log({ a, b, c })
      const id1 = rand()
      const id2 = rand()

      amounts = [a, b, c]

      if(a) {
        transactions.push(id1)

        await Transaction.insert({
          id:      id1,
          date:    new Date(),
          user_id:  user.id,
          type:   'out',
          value:   a,
          name:   'activation',
          virtual: true,
        })
      }

      if(b) {
        transactions.push(id2)

        await Transaction.insert({
          id:      id2,
          date:    new Date(),
          user_id:  user.id,
          type:   'out',
          value:   b,
          name:   'activation',
          virtual: false,
        })
      }
    }

    // save new activation
    await Activation.insert({
      id:     rand(),
      date:   new Date(),
      userId: user.id,
      products,
      price,
      points,
      total,
      // _total,
      check,
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

    // response
    return res.json(success())
  }
}
