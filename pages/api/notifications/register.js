import { MongoClient, ObjectId } from 'mongodb';
import { applyCORS } from '../../../middleware/middleware-cors';
import { getSessionValue } from '../../../components/adminAuth';
import db from '../../../components/db';

const { Session } = db;

export default async function handler(req, res) {
  applyCORS(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { userId, fcmToken, dni } = req.body || {};

  if (!fcmToken || typeof fcmToken !== 'string') {
    return res.status(400).json({ message: 'Faltan datos requeridos (fcmToken)' });
  }

  // Si llega sesión, el usuario sale de la sesión y se ignoran dni/userId del body.
  let query = null;
  const sessionValue = getSessionValue(req);

  if (sessionValue) {
    try {
      const session = await Session.findOne({ value: sessionValue });
      if (!session || session.closedAt || session.closed_at || session.revokedAt || session.revoked_at) {
        return res.status(401).json({ success: false, message: 'invalid session' });
      }
      query = { id: session.id };
    } catch (error) {
      console.error('Error validando sesión en notifications/register:', error.message);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  } else {
    // TEMPORAL (fase 3 exigirá sesión): camino antiguo sin sesión.
    if (!userId && !dni) {
      return res.status(400).json({ message: 'Faltan datos requeridos (userId/dni, fcmToken)' });
    }
    console.warn('[notifications/register] legacy sin sesión');
    if (dni) {
      query = { dni: String(dni) };
    } else if (String(userId).length === 24) {
      try {
        query = { _id: ObjectId(String(userId)) };
      } catch (e) {
        query = { dni: String(userId) };
      }
    } else {
      query = { dni: String(userId) };
    }
  }

  const URL = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sifrah";
  const client = new MongoClient(URL, { useUnifiedTopology: true });

  try {
    await client.connect();
    const mongo = client.db(process.env.DB_NAME || 'sifrah');

    await mongo.collection('users').updateOne(
      query,
      { $set: { fcmToken: fcmToken } }
    );

    res.status(200).json({ success: true, message: 'Token registrado correctamente' });
  } catch (error) {
    console.error('Error registrando token FCM:', error.message);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  } finally {
    await client.close();
  }
}
