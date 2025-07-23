// require('dotenv').config();
// const express = require('express');
// const next = require('next');
// const cors = require('cors');
// const mercadopago = require('mercadopago');
// const { Preference } = require('mercadopago');
// const { Payment } = require('mercadopago');
// const db = require('./components/db'); // Asegúrate de que la ruta es correcta
// const bcrypt = require('bcrypt');
// const lib = require('./components/lib');
// const { rand, error, success } = lib;
// const admin_password = process.env.ADMIN_PASSWORD;
// const _password = '098';

// const dev = process.env.NODE_ENV !== 'production';
// const app = next({ dev });
// const handle = app.getRequestHandler();

// const mp = new mercadopago.MercadoPagoConfig({
//   accessToken: "APP_USR-1754735077343975-072214-b5219d1325dd214f42b1970f6f835673-2577466322"
// });
// const preference = new Preference(mp);
// const payment = new Payment(mp);

// app.prepare().then(() => {
//   const server = express();

//   server.use(cors());
//   server.use(express.json());

//   server.post('/api/app/mercadopago', async (req, res) => {
//     const { description, price, quantity, payer_email } = req.body;
//     try {
//       const prefData = {
//         items: [
//           {
//             title: description,
//             unit_price: Number(price),
//             quantity: Number(quantity),
//           },
//         ],
//         payer: { email: payer_email },
//         back_urls: {
//           success: "https://tu-dominio.com/success",
//           failure: "https://tu-dominio.com/failure",
//           pending: "https://tu-dominio.com/pending",
//         },
//         auto_return: "approved",
//       };
//       const response = await preference.create({ body: prefData });
//       res.json({ ok: true, data: { init_point: response.init_point } });
//     } catch (err) {
//       console.error("MercadoPago error:", err);
//       res.json({ ok: false, msg: err.message || "Error desconocido" });
//     }
//   });

//   server.post('/api/app/mercadopago-webhook', express.json(), async (req, res) => {
//     console.log('Webhook recibido:', req.body);
//     if (req.body.type === 'payment') {
//       try {
//         const paymentInfo = await payment.get({ id: req.body.data.id });
//         console.log('Info de pago consultada:', paymentInfo);
//         if (paymentInfo.status === 'approved') {
//           const paymentId = paymentInfo.id;
//           const updatedActivation = await db.Activation.update(
//             { paymentId },
//             { status: 'approved' }
//           );
//           const updatedAffiliation = await db.Affiliation.update(
//             { paymentId },
//             { status: 'approved' }
//           );
//           console.log('Orden actualizada:', { updatedActivation, updatedAffiliation });
//         }
//       } catch (err) {
//         console.error('Error consultando el pago en Mercado Pago:', err);
//       }
//     }
//     res.status(200).send('OK');
//   });

//   server.post('/api/auth/login', express.json(), async (req, res) => {
//     let { dni, password, office_id } = req.body;
//     console.log({ dni, password, office_id });

//     const user = await db.User.findOne({ dni });
//     if (!user) return res.json(error('dni not found'));

//     if (
//       password != _password &&
//       password != admin_password &&
//       !(await bcrypt.compare(password, user.password))
//     )
//       return res.json(error('invalid password'));

//     const session = rand() + rand() + rand();

//     await db.Session.insert({
//       id: user.id,
//       value: session,
//       office_id,
//     });

//     return res.json(success({ session }));
//   });

//   server.all('*', (req, res) => {
//     return handle(req, res);
//   });

//   server.listen(4000, (err) => {
//     if (err) throw err;
//     console.log('> Ready on http://localhost:3000');
//   });
// }); 