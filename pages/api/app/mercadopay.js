// import axios from 'axios';

// export default async function handler(req, res) {
//   // Habilitar CORS
//   res.setHeader('Access-Control-Allow-Origin', '*');
//   res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

//   if (req.method === 'OPTIONS') {
//     return res.status(200).end();
//   }

//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Método no permitido' });
//   }

//   const { description, price, quantity, payer_email } = req.body;
//   const accessToken = process.env.MP_ACCESS_TOKEN; // Pon tu token en .env

//   try {
//     const response = await axios.post(
//       'https://api.mercadopago.com/checkout/preferences',
//       {
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
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//         },
//       }
//     );
//     res.status(200).json({ init_point: response.data.init_point });
//   } catch (err) {
//     // LOG DETALLADO
//     console.error('Mercado Pago error:', err.response?.data || err.message);
//     res.status(500).json({ error: err.response?.data || err.message });
//   }
// } 