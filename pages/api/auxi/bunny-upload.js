import Busboy from 'busboy';
import https from 'https';
const { applyCORS } = require('../../../middleware/middleware-cors');

export const config = {
  api: {
    bodyParser: false,
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

  console.log(`[Bunny-Native] New upload request. Length: ${req.headers['content-length']}`);

  return new Promise((resolve) => {
    const busboy = Busboy({ 
      headers: req.headers,
      limits: { fileSize: 100 * 1024 * 1024 } // 100MB
    });

    let fields = {};
    let isTerminated = false;

    const terminate = (status, data) => {
      if (isTerminated) return;
      isTerminated = true;
      console.log(`[Bunny-Native] Finalizing with status ${status}`);
      if (!res.writableEnded) {
        res.status(status).json(data);
      }
      resolve();
    };

    req.on('error', (err) => {
      console.error('[Bunny-Native] Request error:', err.message);
      terminate(500, { error: `Request error: ${err.message}` });
    });

    req.on('aborted', () => {
      console.warn('[Bunny-Native] Client aborted connection');
      isTerminated = true;
      resolve();
    });

    busboy.on('field', (name, val) => {
      fields[name] = val;
    });

    busboy.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const fileName = fields.fileName || filename;
      const dir = fields.dir || 'general';

      console.log(`[Bunny-Native] File detected: ${fileName} (${mimeType})`);

      const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
      const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
      const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
      const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

      if (!storageZoneName || !storagePassword || !pullZoneUrl) {
        console.error('[Bunny-Native] Missing credentials');
        file.resume();
        return;
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

      console.log(`[Bunny-Native] Streaming to Bunny: ${path}`);

      const bunnyReq = https.request(bunnyUrl, {
        method: 'PUT',
        headers: {
          'AccessKey': storagePassword,
          'Content-Type': mimeType || 'application/octet-stream',
        }
      }, (bunnyRes) => {
        let responseData = '';
        bunnyRes.on('data', (chunk) => { responseData += chunk; });
        bunnyRes.on('end', () => {
          if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
            const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
            terminate(200, { url: `${basePullUrl}${path}` });
          } else {
            console.error(`[Bunny-Native] Bunny error (${bunnyRes.statusCode}): ${responseData}`);
            terminate(500, { error: `Bunny storage error: ${bunnyRes.statusCode}` });
          }
        });
      });

      bunnyReq.on('error', (err) => {
        console.error('[Bunny-Native] Stream to Bunny failed:', err.message);
        terminate(500, { error: `Upload stream failed: ${err.message}` });
      });

      // Pasar los datos directamente del navegador a Bunny.net
      file.pipe(bunnyReq);
    });

    busboy.on('error', (err) => {
      console.error('[Bunny-Native] Busboy error:', err.message);
      terminate(500, { error: err.message });
    });

    busboy.on('finish', () => {
      console.log('[Bunny-Native] Form data parsing complete');
      // No resolvemos aquí, esperamos a que el stream de archivo termine o falle
    });

    req.pipe(busboy);
  });
};

export default handler;
