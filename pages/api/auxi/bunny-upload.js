import https from 'https';
const { applyCORS } = require('../../../middleware/middleware-cors');

export const config = {
  api: {
    bodyParser: false, // Manejo manual para evitar cortes prematuros
    externalResolver: true,
  },
};

const handler = async (req, res) => {
  applyCORS(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Metadatos por URL para máxima estabilidad
  const fileName = req.query.fileName;
  const dir = req.query.dir || 'general';

  if (!fileName) {
    return res.status(400).json({ error: 'Falta nombre de archivo en URL' });
  }

  console.log(`[Bunny-Final] Receving: ${fileName} | Expecting: ${req.headers['content-length']} bytes`);

  try {
    // Fase 1: Recopilación total en Memoria
    const buffer = await new Promise((resolve, reject) => {
      let chunks = [];
      let totalReceived = 0;

      req.on('data', (chunk) => {
        chunks.push(chunk);
        totalReceived += chunk.length;
      });

      req.on('end', () => {
        console.log(`[Bunny-Final] Fully received: ${totalReceived} bytes`);
        resolve(Buffer.concat(chunks));
      });

      req.on('error', (err) => {
        console.error('[Bunny-Final] Input Stream Error:', err.message);
        reject(err);
      });

      // Si el cliente corta, limpiamos
      req.on('aborted', () => {
        reject(new Error('Client aborted'));
      });
    });

    if (buffer.length === 0) throw new Error('Empty file received');

    // Fase 2: Subida Segura a Bunny
    const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
    const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
    const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'br.storage.bunnycdn.com';
    const pullZoneUrl = 'https://sifraht.b-cdn.net/';

    const folderMapping = {
      'perfil': 'perfiles', 'photos': 'perfiles', 'audios': 'audios',
      'product': 'productos', 'banner': 'banners', 'flyer': 'flyers'
    };
    const targetFolder = folderMapping[dir] || dir;
    const path = `${targetFolder}/${fileName}`;
    const bunnyUrl = `https://${storageHostname}/${storageZoneName}/${path}`;

    const bunnyReq = https.request(bunnyUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': storagePassword,
        'Content-Type': req.headers['content-type'] || 'application/octet-stream',
        'Content-Length': buffer.length
      }
    }, (bunnyRes) => {
      let responseData = '';
      bunnyRes.on('data', d => responseData += d);
      bunnyRes.on('end', () => {
        if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
          console.log(`[Bunny-Final] SUCCESS: ${path}`);
          res.status(200).json({ url: `${pullZoneUrl}${path}` });
        } else {
          console.error(`[Bunny-Final] Bunny Error ${bunnyRes.statusCode}: ${responseData}`);
          res.status(500).json({ error: `Bunny Auth/API Error: ${bunnyRes.statusCode}` });
        }
      });
    });

    bunnyReq.on('error', e => { throw e; });
    bunnyReq.write(buffer);
    bunnyReq.end();

  } catch (err) {
    if (err.message === 'Client aborted') {
      console.warn('[Bunny-Final] Client connection interrupted (H27/499)');
      // No respondemos porque el socket ya está muerto
    } else {
      console.error('[Bunny-Final] Critical Error:', err.message);
      if (!res.writableEnded) res.status(500).json({ error: err.message });
    }
  }
};

export default handler;
