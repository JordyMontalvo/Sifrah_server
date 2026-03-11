import Busboy from 'busboy';
import axios from 'axios';
const { applyCORS } = require('../../../middleware/middleware-cors');

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

const handler = async (req, res) => {
  // Aplicar CORS
  applyCORS(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log(`[Bunny-Stream] Incoming request...`);

  return new Promise((resolve) => {
    const busboy = Busboy({ 
        headers: req.headers,
        limits: { fileSize: 100 * 1024 * 1024 } // 100MB
    });

    let fields = {};
    let uploadPromise = null;
    let isAborted = false;

    req.on('aborted', () => {
      console.warn('[Bunny-Stream] Request aborted by client');
      isAborted = true;
    });

    busboy.on('field', (name, val) => {
      fields[name] = val;
    });

    busboy.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const fileName = fields.fileName || filename;
      const dir = fields.dir || 'general';

      console.log(`[Bunny-Stream] Processing file: ${fileName} in dir: ${dir}`);

      const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
      const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
      const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
      const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

      if (!storageZoneName || !storagePassword || !pullZoneUrl) {
        console.error('[Bunny-Stream] Missing configuration');
        file.resume(); // Consumir el stream para no colgar
        return;
      }

      const folderMapping = {
        'activacion': 'activaciones',
        'activations': 'activaciones',
        'afiliacion': 'afiliaciones',
        'affiliations': 'afiliaciones',
        'banner': 'banners',
        'banners': 'banners',
        'activation_banner': 'banners/activation',
        'affiliation_banner': 'banners/affiliation',
        'flyer': 'flyers',
        'flyes': 'flyers',
        'perfil': 'perfiles',
        'photos': 'perfiles',
        'product': 'productos',
        'producto': 'productos',
        'plan': 'planes',
        'audios': 'audios'
      };

      const targetFolder = folderMapping[dir] || dir;
      const path = `${targetFolder}/${fileName}`;

      console.log(`[Bunny-Stream] Uploading to: ${path}`);

      uploadPromise = axios({
        method: 'put',
        url: `https://${storageHostname}/${storageZoneName}/${path}`,
        headers: {
          'AccessKey': storagePassword,
          'Content-Type': mimeType || 'application/octet-stream',
        },
        data: file, // Pasar el stream directamente
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }).then(response => {
        if (response.status === 201 || response.status === 200) {
          const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
          return { url: `${basePullUrl}${path}` };
        }
        throw new Error(`Bunny error: ${response.status}`);
      }).catch(err => {
        console.error(`[Bunny-Stream] Axios error: ${err.message}`);
        throw err;
      });
    });

    busboy.on('error', (err) => {
      console.error('[Bunny-Stream] Busboy error:', err.message);
      if (!res.writableEnded) res.status(500).json({ error: err.message });
      resolve();
    });

    busboy.on('finish', async () => {
      console.log('[Bunny-Stream] Form parsing finished');
      if (isAborted) return resolve();

      try {
        if (!uploadPromise) {
          if (!res.writableEnded) res.status(400).json({ error: 'No file found in request' });
        } else {
          const result = await uploadPromise;
          if (!res.writableEnded) res.json(result);
        }
      } catch (err) {
        if (!res.writableEnded) res.status(500).json({ error: `Upload failed: ${err.message}` });
      }
      resolve();
    });

    req.pipe(busboy);
  });
};

export default handler;
