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

  // Metadatos vía Query Params (más estable que headers)
  const fileName = req.query.fileName;
  const dir = req.query.dir || 'general';

  if (!fileName) {
    console.error('[Bunny-Mem] Error: Missing fileName in query');
    return res.status(400).json({ error: 'Falta parametro fileName en la URL' });
  }

  console.log(`[Bunny-Mem] Starting upload: ${fileName} to ${dir}`);

  // Paso 1: Acumular TODO el archivo en memoria (Buffer)
  // Esto evita que Heroku piense que la conexión está "colgada"
  let chunks = [];
  let totalLength = 0;

  req.on('data', (chunk) => {
    chunks.push(chunk);
    totalLength += chunk.length;
  });

  req.on('error', (err) => {
    console.error('[Bunny-Mem] Request error:', err.message);
    if (!res.writableEnded) res.status(500).json({ error: 'Error recibiendo archivo' });
  });

  req.on('end', () => {
    const buffer = Buffer.concat(chunks);
    console.log(`[Bunny-Mem] File received. Size: ${totalLength} bytes`);

    const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
    const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
    const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
    const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

    if (!storageZoneName || !storagePassword || !pullZoneUrl) {
      return res.status(500).json({ error: 'Configuración de Bunny ausente' });
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
    const path = `${targetFolder}/${fileName}`;
    const bunnyUrl = `https://${storageHostname}/${storageZoneName}/${path}`;

    // Paso 2: Subir el Buffer completo a Bunny.net
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
          console.log(`[Bunny-Mem] Upload Success: ${path}`);
          res.status(200).json({ url: `${basePullUrl}${path}` });
        } else {
          console.error(`[Bunny-Mem] Bunny Error ${bunnyRes.statusCode}: ${responseData}`);
          res.status(500).json({ error: `Bunny error: ${bunnyRes.statusCode}` });
        }
      });
    });

    bunnyReq.on('error', (e) => {
      console.error('[Bunny-Mem] Bunny API failed:', e.message);
      if (!res.writableEnded) res.status(500).json({ error: e.message });
    });

    bunnyReq.write(buffer);
    bunnyReq.end();
  });
};

export default handler;
