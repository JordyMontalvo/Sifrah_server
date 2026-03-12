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

  console.log(`[BunnyUp] === NEW REQUEST ===`);
  console.log(`[BunnyUp] Body keys: ${Object.keys(req.body || {}).join(', ')}`);

  const fileName = req.body?.fileName || req.query?.fileName;
  const dir      = req.body?.dir      || req.query?.dir || 'general';
  const fileData = req.body?.fileData;

  console.log(`[BunnyUp] fileName: ${fileName} | dir: ${dir} | fileData: ${fileData ? fileData.length + ' chars' : 'MISSING'}`);

  if (!fileName || !fileData) {
    console.error(`[BunnyUp] ERROR: Missing required fields`);
    return res.status(400).json({ error: `Faltan datos. fileName: ${!!fileName}, fileData: ${!!fileData}` });
  }

  try {
    const buffer = Buffer.from(fileData, 'base64');
    console.log(`[BunnyUp] Buffer size: ${buffer.length} bytes`);

    const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
    const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
    const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'br.storage.bunnycdn.com';
    const pullZoneUrl     = (process.env.BUNNY_PULL_ZONE_URL || 'https://sifraht.b-cdn.net').replace(/\/$/, '');

    console.log(`[BunnyUp] Zone: ${storageZoneName} | Host: ${storageHostname} | PullZone: ${pullZoneUrl}`);
    console.log(`[BunnyUp] Password set: ${!!storagePassword}`);

    const folderMapping = {
      'perfil': 'perfiles', 'photos': 'perfiles', 'audios': 'audios',
      'product': 'productos', 'banner': 'banners', 'flyer': 'flyers'
    };
    const targetFolder = folderMapping[dir] || dir;
    const path = `${targetFolder}/${fileName}`;
    const bunnyUrl = `https://${storageHostname}/${storageZoneName}/${path}`;

    console.log(`[BunnyUp] Sending ${buffer.length} bytes to: ${bunnyUrl}`);

    const bunnyReq = https.request(bunnyUrl, {
      method: 'PUT',
      headers: {
        'AccessKey':      storagePassword,
        'Content-Type':   'application/octet-stream',
        'Content-Length': buffer.length
      }
    }, (bunnyRes) => {
      let responseData = '';
      bunnyRes.on('data', d => responseData += d);
      bunnyRes.on('end', () => {
        console.log(`[BunnyUp] Bunny responded: ${bunnyRes.statusCode} | Body: ${responseData}`);
        if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
          const url = `${pullZoneUrl}/${path}`;
          console.log(`[BunnyUp] SUCCESS! Public URL: ${url}`);
          res.status(200).json({ url });
        } else {
          console.error(`[BunnyUp] BUNNY ERROR ${bunnyRes.statusCode}: ${responseData}`);
          res.status(500).json({ error: `Bunny error ${bunnyRes.statusCode}: ${responseData}` });
        }
      });
    });

    bunnyReq.on('error', (e) => {
      console.error(`[BunnyUp] HTTPS Request Error: ${e.message}`);
      if (!res.writableEnded) res.status(500).json({ error: `Network error: ${e.message}` });
    });

    bunnyReq.write(buffer);
    bunnyReq.end();

  } catch (err) {
    console.error(`[BunnyUp] CATCH Error: ${err.message}`);
    if (!res.writableEnded) res.status(500).json({ error: err.message });
  }
};

export default handler;
