import axios from 'axios';
import Cors from 'micro-cors';

const cors = Cors({
  allowMethods: ['POST', 'OPTIONS'],
});

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { amount, email, customerName, orderId } = req.body;

  if (!amount) {
    return res.status(400).json({ error: 'Amount is required' });
  }

  // TODO: El usuario debe configurar estas variables en server/.env
  // Estas credenciales se obtienen desde Back Office Izipay (micuentaweb.pe)
  const username = process.env.IZIPAY_USERNAME || '11223344'; // Shop ID
  const password = process.env.IZIPAY_PASSWORD || 'testpassword_1234567890'; // Test/Prod password

  // Autenticación Basic de Izipay (Base64)
  const authString = Buffer.from(`${username}:${password}`).toString('base64');

  try {
    const data = {
      amount: Math.round(Number(amount) * 100), // Izipay espera centavos (Ej: S/ 10.50 -> 1050)
      currency: 'PEN',
      orderId: orderId || `ORDER-${Date.now()}`,
      customer: {
        email: email || 'cliente@sifrah.com',
        billingDetails: {
          firstName: customerName || 'Cliente',
        }
      }
    };

    const response = await axios.post(
      'https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment',
      data,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (response.data.status === 'SUCCESS') {
      return res.status(200).json({
        formToken: response.data.answer.formToken,
        orderId: data.orderId
      });
    } else {
      console.error('Error Izipay (Status no exitoso):', response.data);
      return res.status(500).json({ error: 'Error al generar token de pago', details: response.data });
    }
  } catch (error) {
    console.error('Error Izipay Request:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Error al comunicarse con Izipay', details: error.response?.data || error.message });
  }
}

export default cors(handler);
