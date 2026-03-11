import https from 'https';
const { applyCORS } = require('../../../middleware/middleware-cors');

export const config = {
  api: {
    bodyParser: false, // Vital para recibir streaming binario
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

  // Leer metadatos de las cabeceras personalizadas
  const fileName = req.headers['x-file-name'];
  const dir = req.headers['x-dir'] || 'general';

  if (!fileName) {
    console.error('[Bunny-Binary] Error: Missing x-file-name header');
    return res.status(400).json({ error: 'Falta cabecera x-file-name' });
  }

  console.log(`[Bunny-Binary] INCOMING: ${fileName} | DIR: ${dir} | SIZE: ${req.headers['content-length']}`);

  const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
  const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
  const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
  const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

  if (!storageZoneName || !storagePassword || !pullZoneUrl) {
    return res.status(500).json({ error: 'Error de configuración en servidor' });
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

  console.log(`[Bunny-Binary] PROXYING TO: ${bunnyPath}`);

  // Creamos la petición hacia Bunny.net
  const bunnyReq = https.request(bunnyUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': storagePassword,
      'Content-Type': req.headers['content-type'] || 'application/octet-stream',
      'Content-Length': req.headers['content-length']
    }
  }, (bunnyRes) => {
    let responseData = '';
    bunnyRes.on('data', (d) => { responseData += d; });
    bunnyRes.on('end', () => {
      if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
        const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
        console.log(`[Bunny-Binary] SUCCESS: ${bunnyPath}`);
        res.status(200).json({ url: `${basePullUrl}${bunnyPath}` });
      } else {
        console.error(`[Bunny-Binary] Bunny Error ${bunnyRes.statusCode}: ${responseData}`);
        res.status(500).json({ error: `Bunny error: ${bunnyRes.statusCode}` });
      }
    });
  });

  bunnyReq.on('error', (e) => {
    console.error('[Bunny-Binary] Proxy Error:', e.message);
    if (!res.writableEnded) res.status(500).json({ error: e.message });
  });

  // Reenviar el cuerpo binario directamente (Sin procesar ni guardar en disco)
  req.pipe(bunnyReq);
};

export default handler;
