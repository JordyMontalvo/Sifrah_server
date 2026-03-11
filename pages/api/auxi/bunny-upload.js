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

  // 1. Extraer metadatos de donde sea que vengan (Body o Query)
  const fileName = req.body.fileName || req.query.fileName;
  const dir = req.body.dir || req.query.dir || 'general';
  const mimeType = req.headers['content-type'] || req.body.mimeType || 'application/octet-stream';

  if (!fileName) {
    console.error('[Bunny-Hybrid] Error: Missing fileName');
    return res.status(400).json({ error: 'Falta nombre del archivo' });
  }

  try {
    let buffer;

    // 2. Determinar si los datos vienen en JSON (Base64) o Raw Stream
    if (req.body && req.body.fileData) {
      console.log(`[Bunny-Hybrid] Mode: JSON/Base64 | File: ${fileName}`);
      buffer = Buffer.from(req.body.fileData, 'base64');
    } else {
      console.log(`[Bunny-Hybrid] Mode: Raw Stream | File: ${fileName}`);
      // Si req.body está vacío (parser falló o enviaron binario puro), leemos el stream
      // Nota: Next.js a veces ya consumió el stream si bodyParser está on. 
      // Por seguridad, si llegamos aquí y no hay body, intentamos leer chunks remanentes.
      buffer = await new Promise((resolve, reject) => {
        let chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });
    }

    if (!buffer || buffer.length === 0) {
      throw new Error('El cuerpo de la petición está vacío o no se pudo procesar.');
    }

    console.log(`[Bunny-Hybrid] Final buffer size: ${buffer.length} bytes`);

    const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
    const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
    const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
    const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

    // Mapeo de carpetas
    const folderMapping = {
      'perfil': 'perfiles', 'photos': 'perfiles', 'audios': 'audios',
      'product': 'productos', 'banner': 'banners', 'flyer': 'flyers'
    };
    const targetFolder = folderMapping[dir] || dir;
    const path = `${targetFolder}/${fileName}`;
    const bunnyUrl = `https://${storageHostname}/${storageZoneName}/${path}`;

    // 3. Subida Directa a Bunny.net
    const bunnyReq = https.request(bunnyUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': storagePassword,
        'Content-Type': mimeType,
        'Content-Length': buffer.length
      }
    }, (bunnyRes) => {
      let responseData = '';
      bunnyRes.on('data', d => responseData += d);
      bunnyRes.on('end', () => {
        if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
          const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
          console.log(`[Bunny-Hybrid] SUCCESS: ${path}`);
          res.status(200).json({ url: `${basePullUrl}${path}` });
        } else {
          res.status(500).json({ error: `Bunny storage error: ${bunnyRes.statusCode}` });
        }
      });
    });

    bunnyReq.on('error', e => { throw e; });
    bunnyReq.write(buffer);
    bunnyReq.end();

  } catch (err) {
    console.error('[Bunny-Hybrid] Critical Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

export default handler;
