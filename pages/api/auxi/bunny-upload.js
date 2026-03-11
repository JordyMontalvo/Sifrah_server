import https from 'https';
const { applyCORS } = require('../../../middleware/middleware-cors');

export const config = {
  api: {
    bodyParser: false, // Desactivamos el parser automático de Next.js
    externalResolver: true,
  },
};

const handler = async (req, res) => {
  applyCORS(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const fileName = req.query.fileName;
  const dir = req.query.dir || 'general';

  if (!fileName) {
    return res.status(400).json({ error: 'Falta fileName' });
  }

  console.log(`[Bunny-Debug] >>> New Request: ${fileName} | Expecting: ${req.headers['content-length']} bytes`);

  let chunks = [];
  let received = 0;

  req.on('data', (chunk) => {
    received += chunk.length;
    chunks.push(chunk);
    // Loguear cada 200KB para no saturar pero ver progreso
    if (received % (200 * 1024) < chunk.length) {
      console.log(`[Bunny-Debug] Receiving: ${received} bytes...`);
    }
  });

  req.on('close', () => {
    if (received < (req.headers['content-length'] || 0)) {
      console.error(`[Bunny-Debug] !!! Connection CLOSED prematurely by client/router at ${received} bytes`);
    }
  });

  req.on('end', async () => {
    console.log(`[Bunny-Debug] Finished receiving. Total: ${received} bytes. Processing to Bunny...`);
    const buffer = Buffer.concat(chunks);

    const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
    const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
    const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
    const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

    const folderMapping = {
      'activacion': 'activaciones', 'activations': 'activaciones',
      'afiliacion': 'afiliaciones', 'affiliations': 'afiliaciones',
      'banner': 'banners', 'banners': 'banners',
      'activation_banner': 'banners/activation',
      'affiliation_banner': 'banners/affiliation',
      'flyer': 'flyers', 'flyes': 'flyers',
      'perfil': 'perfiles', 'photos': 'perfiles',
      'product': 'productos', 'producto': 'productos',
      'plan': 'planes', 'audios': 'audios'
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
      bunnyRes.on('data', (d) => { responseData += d; });
      bunnyRes.on('end', () => {
        if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
          const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
          res.status(200).json({ url: `${basePullUrl}${path}` });
        } else {
          console.error(`[Bunny-Debug] Bunny API Error ${bunnyRes.statusCode}`);
          res.status(500).json({ error: 'Error en almacenamiento' });
        }
      });
    });

    bunnyReq.on('error', (e) => {
      console.error('[Bunny-Debug] Bunny Connection Error:', e.message);
      res.status(500).json({ error: 'Error de conexion con Bunny' });
    });

    bunnyReq.write(buffer);
    bunnyReq.end();
  });
};

export default handler;
