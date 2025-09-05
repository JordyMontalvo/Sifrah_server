const { applyCORS } = require('../../../middleware/middleware-cors');

module.exports = async function handler(req, res) {
  applyCORS(req, res);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    // Conectar a la base de datos
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const client = new MongoClient(uri);

    await client.connect();
    const db = client.db('sifrah');
    const usersCollection = db.collection('users');

    // Buscar si el email existe
    const user = await usersCollection.findOne({ email: email.toLowerCase() });

    await client.close();

    if (!user) {
      return res.status(404).json({ 
        error: 'Email no encontrado',
        exists: false 
      });
    }

    // Email existe, pero no enviamos información sensible
    res.status(200).json({ 
      success: true,
      exists: true,
      message: 'Email válido'
    });

  } catch (error) {
    console.error('Error validando email:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      exists: false 
    });
  }
}; 