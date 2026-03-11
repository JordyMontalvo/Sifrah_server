import https from 'https';
const { applyCORS } = require('../../../middleware/middleware-cors');

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb', // Permitir JSONs grandes con Base64
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

  // En modo Safe-Mode, los datos vienen en el body JSON
  const { fileName, dir, fileData, mimeType } = req.body;

  if (!fileName || !fileData) {
    console.error('[Bunny-Safe] Error: Missing fileName or fileData in JSON body');
    return res.status(400).json({ error: 'Faltan datos en la petición JSON' });
  }

  console.log(`[Bunny-Safe] Processing: ${fileName} | Folder: ${dir}`);

  // Decodificar Base64 a Buffer
  const buffer = Buffer.from(fileData, 'base64');
  console.log(`[Bunny-Safe] Decoded buffer size: ${buffer.length} bytes`);

  const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
  const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
  const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
  const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

  if (!storageZoneName || !storagePassword || !pullZoneUrl) {
    return res.status(500).json({ error: 'Configuración de Bunny incompleta' });
  }

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
  const bunnyPath = `${targetFolder}/${fileName}`;
  const bunnyUrl = `https://${storageHostname}/${storageZoneName}/${bunnyPath}`;

  // Subir a Bunny
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
        console.log(`[Bunny-Safe] SUCCESS: ${bunnyPath}`);
        res.status(200).json({ url: `${basePullUrl}${bunnyPath}` });
      } else {
        console.error(`[Bunny-Safe] Bunny Error ${bunnyRes.statusCode}: ${responseData}`);
        res.status(500).json({ error: `Bunny storage error: ${bunnyRes.statusCode}` });
      }
    });
  });

  bunnyReq.on('error', (e) => {
    console.error('[Bunny-Safe] Bunny API Error:', e.message);
    if (!res.writableEnded) res.status(500).json({ error: e.message });
  });

  bunnyReq.write(buffer);
  bunnyReq.end();
};

export default handler;
