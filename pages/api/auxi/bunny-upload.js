import formidable from 'formidable';
import fs from 'fs';
import https from 'https';
import path from 'path';
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

  console.log(`[Bunny-Robust] Starting robust upload. CL: ${req.headers['content-length']}`);

  const form = new formidable.IncomingForm({
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    uploadDir: '/tmp', // Heroku permite escribir en /tmp
  });

  return new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('[Bunny-Robust] Formidable parsing error:', err.message);
        if (!res.writableEnded) res.status(500).json({ error: `Upload error: ${err.message}` });
        return resolve();
      }

      const file = files.file instanceof Array ? files.file[0] : files.file;
      if (!file) {
        console.warn('[Bunny-Robust] No file found in request');
        if (!res.writableEnded) res.status(400).json({ error: 'No file uploaded' });
        return resolve();
      }

      console.log(`[Bunny-Robust] File received on disk: ${file.filepath || file.path}`);

      const fileName = fields.fileName || file.originalFilename || file.name;
      const dir = fields.dir || 'general';

      const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
      const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
      const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
      const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

      if (!storageZoneName || !storagePassword || !pullZoneUrl) {
          console.error('[Bunny-Robust] Credentials error');
          if (!res.writableEnded) res.status(500).json({ error: 'Bunny credentials missing' });
          return resolve();
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

      console.log(`[Bunny-Robust] Starting transfer to Bunny: ${bunnyPath}`);

      try {
        const fileStream = fs.createReadStream(file.filepath || file.path);
        const stats = fs.statSync(file.filepath || file.path);

        const bunnyReq = https.request(bunnyUrl, {
          method: 'PUT',
          headers: {
            'AccessKey': storagePassword,
            'Content-Type': file.mimetype || 'application/octet-stream',
            'Content-Length': stats.size
          }
        }, (bunnyRes) => {
          let responseData = '';
          bunnyRes.on('data', (chunk) => { responseData += chunk; });
          bunnyRes.on('end', () => {
            // Limpiar archivo temporal siempre
            fs.unlink(file.filepath || file.path, () => {});

            if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
              const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
              if (!res.writableEnded) res.json({ url: `${basePullUrl}${bunnyPath}` });
              console.log('[Bunny-Robust] Transfer success');
            } else {
              console.error(`[Bunny-Robust] Bunny Error: ${bunnyRes.statusCode}`);
              if (!res.writableEnded) res.status(500).json({ error: `Bunny storage error: ${bunnyRes.statusCode}` });
            }
            resolve();
          });
        });

        bunnyReq.on('error', (uploadErr) => {
          console.error('[Bunny-Robust] Bunny Upload Error:', uploadErr.message);
          fs.unlink(file.filepath || file.path, () => {});
          if (!res.writableEnded) res.status(500).json({ error: `Upload stream failed: ${uploadErr.message}` });
          resolve();
        });

        fileStream.pipe(bunnyReq);

      } catch (streamErr) {
        console.error('[Bunny-Robust] local FS error:', streamErr.message);
        if (!res.writableEnded) res.status(500).json({ error: streamErr.message });
        resolve();
      }
    });
  });
};

export default handler;
