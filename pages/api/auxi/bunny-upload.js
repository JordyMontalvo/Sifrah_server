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
  applyCORS(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log(`[Bunny-Final] >>> START NEW UPLOAD REQUEST`);
  console.log(`[Bunny-Final] User-Agent: ${req.headers['user-agent']}`);
  console.log(`[Bunny-Final] Content-Length: ${req.headers['content-length']}`);

  return new Promise((resolve) => {
    let isTerminated = false;
    const terminate = (status, data) => {
      if (isTerminated) return;
      isTerminated = true;
      console.log(`[Bunny-Final] Request terminated with status ${status}`);
      if (!res.writableEnded) {
        res.status(status).json(data);
      }
      resolve();
    };

    const busboy = Busboy({ 
      headers: req.headers,
      limits: { fileSize: 100 * 1024 * 1024 } // 100MB
    });

    let fields = {};
    let uploadPromise = null;

    req.on('aborted', () => {
      console.warn('[Bunny-Final] !! Client aborted connection mid-stream');
      isTerminated = true;
      resolve();
    });

    busboy.on('field', (name, val) => {
      console.log(`[Bunny-Final] Field [${name}]: ${val}`);
      fields[name] = val;
    });

    busboy.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const fileName = fields.fileName || filename;
      const dir = fields.dir || 'general';

      console.log(`[Bunny-Final] File Event detected: ${fileName} (${mimeType})`);

      const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
      const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
      const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
      const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

      if (!storageZoneName || !storagePassword || !pullZoneUrl) {
        console.error('[Bunny-Final] ERROR: Configuration missing in .env');
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
      console.log(`[Bunny-Final] Targeted Bunny Path: ${path}`);

      uploadPromise = axios({
        method: 'put',
        url: `https://${storageHostname}/${storageZoneName}/${path}`,
        headers: {
          'AccessKey': storagePassword,
          'Content-Type': mimeType || 'application/octet-stream',
        },
        data: file,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }).then(response => {
        console.log(`[Bunny-Final] Bunny API Response: ${response.status}`);
        const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
        return { url: `${basePullUrl}${path}` };
      }).catch(err => {
        console.error(`[Bunny-Final] Bunny API Upload Failed: ${err.message}`);
        throw err;
      });
    });

    busboy.on('error', (err) => {
      console.error('[Bunny-Final] Busboy parser error:', err.message);
      terminate(500, { error: err.message });
    });

    busboy.on('finish', async () => {
      console.log('[Bunny-Final] Busboy reached end of form data');
      if (isTerminated) return;

      try {
        if (!uploadPromise) {
          console.warn('[Bunny-Final] No file parts were detected in form');
          terminate(400, { error: 'No file found' });
        } else {
          const result = await uploadPromise;
          terminate(200, result);
        }
      } catch (err) {
        terminate(500, { error: `Upload process failed: ${err.message}` });
      }
    });

    req.pipe(busboy);
  });
};

export default handler;
