import https from 'https';
const { applyCORS } = require('../../../middleware/middleware-cors');

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb', 
    },
    externalResolver: true,
  },
};

const handler = async (req, res) => {
  applyCORS(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Extraer metadatos (soporta Query y Body)
  const fileName = req.body?.fileName || req.query?.fileName;
  const dir = req.body?.dir || req.query?.dir || 'general';
  
  if (!fileName) return res.status(400).json({ error: 'Falta nombre del archivo' });

  try {
    let buffer;
    if (req.body?.fileData) {
      console.log(`[Bunny-Final] Mode: JSON/Base64 | File: ${fileName}`);
      buffer = Buffer.from(req.body.fileData, 'base64');
    } else {
      console.log(`[Bunny-Final] Mode: Binary/XHR | File: ${fileName}`);
      // Si llegamos aquí como bodyParser: false, leeríamos stream. 
      // Pero como está activo, req.body será {} si enviamos binario puro.
      // Así que forzamos al cliente a enviar binario puro con bodyParser desactivado O Base64.
      // SOLUCIÓN: Usamos Base64 en el cliente para máxima compatibilidad con Heroku.
      return res.status(400).json({ error: 'El servidor requiere Base64 por JSON para estabilidad' });
    }

    if (!buffer || buffer.length === 0) throw new Error('Archivo vacío');

    // 2. Configuración Dinámica
    const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME || 'sifrah';
    const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
    const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'br.storage.bunnycdn.com';
    const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL || 'https://sifraht.b-cdn.net/';

    const folderMapping = {
      'perfil': 'perfiles', 'photos': 'perfiles', 'audios': 'audios',
      'product': 'productos', 'banner': 'banners', 'flyer': 'flyers'
    };
    const targetFolder = folderMapping[dir] || dir;
    const path = `${targetFolder}/${fileName}`;
    const bunnyUrl = `https://${storageHostname}/${storageZoneName}/${path}`;

    console.log(`[Bunny-Final] Proxying ${buffer.length} bytes to: ${bunnyUrl}`);

    const bunnyReq = https.request(bunnyUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': storagePassword,
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.length
      }
    }, (bunnyRes) => {
      let responseData = '';
      bunnyRes.on('data', d => responseData += d);
      bunnyRes.on('end', () => {
        if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
          const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
          res.status(200).json({ url: `${basePullUrl}${path}` });
        } else {
          console.error(`[Bunny-Final] Bunny Error ${bunnyRes.statusCode}: ${responseData}`);
          res.status(500).json({ error: `Error Bunny: ${bunnyRes.statusCode}` });
        }
      });
    });

    bunnyReq.on('error', e => { throw e; });
    bunnyReq.write(buffer);
    bunnyReq.end();

  } catch (err) {
    console.error('[Bunny-Final] Error:', err.message);
    if (!res.writableEnded) res.status(500).json({ error: err.message });
  }
};

export default handler;
