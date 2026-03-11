import https from 'https';
const { applyCORS } = require('../../../middleware/middleware-cors');

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb', // Permitir audios grandes en Base64
    },
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

  // Recibir datos como JSON (evita problemas de streaming en Heroku)
  const { fileName, dir, fileData, mimeType } = req.body;

  if (!fileName || !fileData) {
    console.error('[Bunny-Safe] Error: Missing data in JSON body');
    return res.status(400).json({ error: 'Faltan datos (fileName o fileData)' });
  }

  console.log(`[Bunny-Safe] Processing: ${fileName} | Size approx: ${Math.round(fileData.length * 0.75)} bytes`);

  try {
    const buffer = Buffer.from(fileData, 'base64');
    
    const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
    const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
    const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
    const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

    if (!storageZoneName || !storagePassword || !pullZoneUrl) {
      throw new Error('Configuracion Bunny incompleta');
    }

    const folderMapping = {
      'activacion': 'activaciones', 'activations': 'activaciones',
      'afiliacion': 'afiliaciones', 'affiliations': 'afiliaciones',
      'banner': 'banners', 'banners': 'banners',
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
        'Content-Type': mimeType || 'application/octet-stream',
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
          res.status(500).json({ error: `Bunny error: ${bunnyRes.statusCode}` });
        }
      });
    });

    bunnyReq.on('error', (e) => {
      console.error('[Bunny-Safe] Bunny Connection Error:', e.message);
      res.status(500).json({ error: e.message });
    });

    bunnyReq.write(buffer);
    bunnyReq.end();

  } catch (err) {
    console.error('[Bunny-Safe] Critical Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

export default handler;
