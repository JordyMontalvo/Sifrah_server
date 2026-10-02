import axios from 'axios';
import lib from '../../../components/lib';

// Tope de cordura para un cobro suelto, muy por encima de cualquier pedido
// real. Solo esta para frenar un importe absurdo, no para limitar las compras.
const MAX_AMOUNT_PEN = Number(process.env.IZIPAY_MAX_AMOUNT_PEN) || 100000;

export default async function handler(req, res) {
  await lib.midd(req, res);

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

  // Sin esto, un importe no numerico llegaba a Izipay como NaN y uno negativo
  // se enviaba tal cual.
  const montoSoles = Number(amount);
  if (!Number.isFinite(montoSoles) || montoSoles <= 0 || montoSoles > MAX_AMOUNT_PEN) {
    return res.status(400).json({ error: 'Amount is invalid' });
  }

  // Izipay rechaza emails inválidos (ej. *.local). Usar fallback seguro.
  const rawEmail = String(email || '').trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) && !/\.local$/i.test(rawEmail);
  const safeEmail = emailOk ? rawEmail : 'cliente@sifrah.com';

  // Antes habia aqui unas credenciales de prueba como valor por defecto: si la
  // configuracion fallaba, los cobros se iban al entorno de pruebas de Izipay
  // sin que nadie se enterase. Mejor fallar de forma visible.
  const username = process.env.IZIPAY_USERNAME;
  const password = process.env.IZIPAY_PASSWORD;

  if (!username || !password) {
    console.error('Izipay: faltan IZIPAY_USERNAME o IZIPAY_PASSWORD en el entorno');
    return res.status(500).json({ error: 'Pasarela de pago no configurada' });
  }

  const authString = Buffer.from(`${username}:${password}`).toString('base64');

  try {
    const data = {
      amount: Math.round(montoSoles * 100),
      currency: 'PEN',
      orderId: orderId || `ORDER-${Date.now()}`,
      customer: {
        email: safeEmail,
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
