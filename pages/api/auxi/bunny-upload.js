import https from 'https';
const { applyCORS } = require('../../../middleware/middleware-cors');

export const config = {
  api: {
    bodyParser: false, // CRITICO: No procesar el cuerpo, dejarlo como stream
    externalResolver: true,
  },
};

const handler = (req, res) => {
  applyCORS(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Metadatos por Query Params (son los únicos disponibles al no haber bodyParser)
  const fileName = req.query.fileName;
  const dir = req.query.dir || 'general';

  if (!fileName) {
    return res.status(400).json({ error: 'Falta fileName en URL' });
  }

  const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
  const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
  // Usar hostname GLOBAL para mayor velocidad desde Heroku
  const storageHostname = 'storage.bunnycdn.com'; 
  const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

  const folderMapping = {
    'perfil': 'perfiles', 'photos': 'perfiles', 'audios': 'audios',
    'product': 'productos', 'banner': 'banners', 'flyer': 'flyers'
  };
  const targetFolder = folderMapping[dir] || dir;
  const path = `${targetFolder}/${fileName}`;
  const bunnyUrl = `https://${storageHostname}/${storageZoneName}/${path}`;

  console.log(`[Bunny-Stream] >>> Proxying: ${fileName} to ${targetFolder}`);

  // Configuramos el túnel hacia Bunny
  const bunnyReq = https.request(bunnyUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': storagePassword,
      'Content-Type': req.headers['content-type'] || 'application/octet-stream',
      // No pasamos Content-Length manual, dejamos que el pipe lo maneje o Bunny lo detecte
    }
  }, (bunnyRes) => {
    let responseData = '';
    bunnyRes.on('data', d => responseData += d);
    bunnyRes.on('end', () => {
      if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
        const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
        console.log(`[Bunny-Stream] SUCCESS: ${path}`);
        res.status(200).json({ url: `${basePullUrl}${path}` });
      } else {
        console.error(`[Bunny-Stream] Bunny Error ${bunnyRes.statusCode}: ${responseData}`);
        res.status(500).json({ error: `Bunny error: ${bunnyRes.statusCode}` });
      }
    });
  });

  bunnyReq.on('error', e => {
    console.error('[Bunny-Stream] Proxy Error:', e.message);
    if (!res.writableEnded) res.status(500).json({ error: 'Error en el túnel de subida' });
  });

  // El "Pase Mágico": Conectamos la entrada del cliente directamente a la salida de Bunny
  req.pipe(bunnyReq);

  // Manejar abortos del cliente
  req.on('aborted', () => {
    console.warn('[Bunny-Stream] ! Client aborted connection');
    bunnyReq.destroy();
  });
};

export default handler;
