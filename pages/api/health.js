import db from '../../components/db';
import lib from '../../components/lib';

export default async function handler(req, res) {
  // CORS basico
  await lib.midd(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const startTime = Date.now();
  let dbStatus = 'disconnected';
  let dbLatencyMs = 0;

  try {
    // Verificacion de conectividad con MongoDB (timeout de 2.5s para no congelar monitores)
    const dbCheckPromise = db.Session.count({});
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DB healthcheck timeout (2500ms)')), 2500)
    );

    await Promise.race([dbCheckPromise, timeoutPromise]);
    dbStatus = 'connected';
    dbLatencyMs = Date.now() - startTime;

    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      environment: process.env.NODE_ENV || 'production',
    });
  } catch (error) {
    dbLatencyMs = Date.now() - startTime;
    return res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: 'error',
        latencyMs: dbLatencyMs,
        error: error.message,
      },
    });
  }
}
