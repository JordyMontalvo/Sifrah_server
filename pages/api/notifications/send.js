import { MongoClient } from 'mongodb';
import admin from 'firebase-admin';

// Inicializar Firebase Admin una sola vez
if (!admin.apps.length) {
  try {
    // Intenta leer el archivo de configuración. Si falla (aún no lo han subido), loguea el error.
    const serviceAccount = require('../../../firebase-adminsdk.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error("No se pudo inicializar Firebase Admin. Asegúrate de tener el archivo firebase-adminsdk.json en la carpeta server/");
  }
}

export default async function handler(req, res) {
  // CORS
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

  if (!admin.apps.length) {
    return res.status(500).json({ success: false, message: 'Firebase Admin no está configurado en el servidor.' });
  }

  const { title, body, userId } = req.body;

  if (!title || !body) {
    return res.status(400).json({ message: 'Faltan datos (title, body)' });
  }

  const URL = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sifrah";
  const client = new MongoClient(URL, { useUnifiedTopology: true });

  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME || 'sifrah');

    let tokens = [];

    if (userId) {
      // Enviar a un usuario específico
      const user = await db.collection('users').findOne({ _id: userId }); // Puedes ajustar si es ObjectId
      if (user && user.fcmToken) {
        tokens.push(user.fcmToken);
      }
    } else {
      // Enviar a TODOS los usuarios que tengan fcmToken
      const usersWithTokens = await db.collection('users').find({ fcmToken: { $exists: true, $ne: null } }).toArray();
      tokens = usersWithTokens.map(u => u.fcmToken);
    }

    if (tokens.length === 0) {
      return res.status(404).json({ success: false, message: 'No se encontraron tokens para enviar la notificación' });
    }

    // Configurar el mensaje
    const message = {
      notification: {
        title: title,
        body: body
      },
      tokens: tokens // Multicast message
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    res.status(200).json({
      success: true,
      message: 'Notificaciones enviadas',
      successCount: response.successCount,
      failureCount: response.failureCount
    });

  } catch (error) {
    console.error('Error enviando notificación push:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await client.close();
  }
}
