import { MongoClient } from 'mongodb';

// Configuración de la base de datos
const DB_URL = process.env.DB_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'sifrah';


let client = null;
let db = null;

/**
 * Conecta a la base de datos MongoDB
 * @returns {Promise<Object>} Instancia de la base de datos
 */
export async function connectDB() {
  try {
    // Si ya hay una conexión activa, la reutilizamos
    if (db) {
      return db;
    }

    // Crear nueva conexión
    client = new MongoClient(DB_URL, {
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    // Conectar al cliente
    await client.connect();
    
    // Obtener instancia de la base de datos
    db = client.db(DB_NAME);
    
    console.log('✅ Conexión a MongoDB establecida');
    return db;
    
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    throw new Error(`Error de conexión a la base de datos: ${error.message}`);
  }
}

/**
 * Cierra la conexión a la base de datos
 */
export async function closeDB() {
  try {
    if (client) {
      await client.close();
      client = null;
      db = null;
      console.log('✅ Conexión a MongoDB cerrada');
    }
  } catch (error) {
    console.error('❌ Error cerrando conexión a MongoDB:', error);
  }
}

/**
 * Verifica el estado de la conexión
 * @returns {boolean} True si la conexión está activa
 */
export function isConnected() {
  return client && client.isConnected();
}

/**
 * Obtiene estadísticas de la base de datos
 * @returns {Promise<Object>} Estadísticas de la base de datos
 */
export async function getDBStats() {
  try {
    const database = await connectDB();
    const stats = await database.stats();
    return {
      collections: stats.collections,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      indexSize: stats.indexSize,
    };
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de la BD:', error);
    return null;
  }
}

/**
 * Verifica que las colecciones necesarias existan
 * @returns {Promise<Object>} Estado de las colecciones
 */
export async function checkCollections() {
  try {
    const database = await connectDB();
    const collections = await database.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    const requiredCollections = [
      'users',
      'affiliations', 
      'transactions',
      'tree',
      'activations',
      'collects'
    ];
    
    const missingCollections = requiredCollections.filter(
      name => !collectionNames.includes(name)
    );
    
    return {
      available: collectionNames,
      required: requiredCollections,
      missing: missingCollections,
      allPresent: missingCollections.length === 0
    };
    
  } catch (error) {
    console.error('❌ Error verificando colecciones:', error);
    return {
      available: [],
      required: [],
      missing: [],
      allPresent: false,
      error: error.message
    };
  }
}

// Manejo de señales para cerrar la conexión limpiamente
process.on('SIGINT', async () => {
  console.log('\n🔄 Cerrando conexiones...');
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Cerrando conexiones...');
  await closeDB();
  process.exit(0);
});

export default {
  connectDB,
  closeDB,
  isConnected,
  getDBStats,
  checkCollections
}; 