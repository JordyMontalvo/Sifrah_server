import https from 'https';
const { applyCORS } = require('../../../middleware/middleware-cors');

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb', // Suficiente para audios grandes
    },
    externalResolver: true,
  },
};

const handler = async (req, res) => {
  applyCORS(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Recibir datos como JSON (Inmune a cortes de stream binary)
  const { fileName, dir, fileData } = req.body;

  if (!fileName || !fileData) {
    console.error(`[Bunny-Safe] Missing data. Body keys: ${Object.keys(req.body || {})}`);
    return res.status(400).json({ error: 'Faltan datos (fileName o fileData)' });
  }

  console.log(`[Bunny-Safe] Processing: ${fileName} (${Math.round(fileData.length / 1024)} KB base64)`);

  try {
    const buffer = Buffer.from(fileData, 'base64');
    
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
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.length
      }
    }, (bunnyRes) => {
      let responseData = '';
      bunnyRes.on('data', d => responseData += d);
      bunnyRes.on('end', () => {
        if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
          console.log(`[Bunny-Safe] SUCCESS: ${path}`);
          res.status(200).json({ url: `${pullZoneUrl}${path}` });
        } else {
          console.error(`[Bunny-Safe] Bunny Error ${bunnyRes.statusCode}: ${responseData}`);
          res.status(bunnyRes.statusCode === 401 ? 401 : 500).json({ error: `Bunny API Error: ${bunnyRes.statusCode}` });
        }
      });
    });

    bunnyReq.on('error', e => { throw e; });
    bunnyReq.write(buffer);
    bunnyReq.end();

  } catch (err) {
    console.error('[Bunny-Safe] Critical Error:', err.message);
    if (!res.writableEnded) res.status(500).json({ error: err.message });
  }
};

export default handler;
