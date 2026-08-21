import { MongoClient, ObjectId } from 'mongodb';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { userId, fcmToken } = req.body;

  if (!userId || !fcmToken) {
    return res.status(400).json({ message: 'Faltan datos requeridos (userId, fcmToken)' });
  }

  const URL = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sifrah";
  const client = new MongoClient(URL, { useUnifiedTopology: true });

  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME || 'sifrah');
    
    let query = { _id: userId };
    try {
        if (userId.length === 24) {
           query = { _id: ObjectId(userId) };
        }
    } catch(e) {}

    const result = await db.collection('users').updateOne(
      query,
      { $set: { fcmToken: fcmToken } }
    );

    res.status(200).json({ success: true, message: 'Token registrado correctamente', result });
  } catch (error) {
    console.error('Error registrando token FCM:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.close();
  }
}
