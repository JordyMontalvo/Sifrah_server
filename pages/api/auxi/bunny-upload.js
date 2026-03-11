import formidable from 'formidable';
import fs from 'fs';
import axios from 'axios';
const { applyCORS } = require('../../../middleware/middleware-cors');

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

const handler = async (req, res) => {
  // Aplicar CORS usando el middleware interno del proyecto
  applyCORS(req, res);

  // Manejar OPTIONS para evitar errores de preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log(`[Bunny] New ${req.method} request to /api/auxi/bunny-upload`);
  console.log(`[Bunny] Content-Type: ${req.headers['content-type']}`);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new formidable.IncomingForm({
    keepExtensions: true,
    multiples: false,
    maxFileSize: 50 * 1024 * 1024, // 50MB
  });

  return new Promise((resolve) => {
    // Escuchar si el request se aborta desde el cliente
    req.on('aborted', () => {
      console.warn('[Bunny] Client aborted the request');
      resolve();
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('[Bunny] Formidable error:', err.message);
        // Evitar responder si el cliente ya cerró la conexión
        if (!res.writableEnded) {
            res.status(500).json({ error: `Error processing upload: ${err.message}` });
        }
        return resolve();
      }

      console.log('[Bunny] Form parsed. Fields:', Object.keys(fields));

      const file = files.file instanceof Array ? files.file[0] : files.file;
      if (!file) {
        console.warn('[Bunny] No file found in request');
        if (!res.writableEnded) res.status(400).json({ error: 'No file uploaded' });
        return resolve();
      }

      const fileName = fields.fileName || file.originalFilename || file.name;
      const dir = fields.dir || 'general';

      const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
      const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
      const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
      const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

      if (!storageZoneName || !storagePassword || !pullZoneUrl) {
          console.error('[Bunny] Configuration missing in .env');
          if (!res.writableEnded) res.status(500).json({ error: 'Bunny configuration missing' });
          return resolve();
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

      console.log(`[Bunny] Uploading to: ${path}`);

      try {
        const fileContent = fs.readFileSync(file.filepath || file.path);

        const response = await axios({
          method: 'put',
          url: `https://${storageHostname}/${storageZoneName}/${path}`,
          headers: {
            'AccessKey': storagePassword,
            'Content-Type': file.mimetype || file.type || 'application/octet-stream',
          },
          data: fileContent,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        if (response.status === 201 || response.status === 200) {
          const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
          const finalUrl = `${basePullUrl}${path}`;
          console.log(`[Bunny] Success! URL: ${finalUrl}`);
          if (!res.writableEnded) res.json({ url: finalUrl });
        } else {
          throw new Error(`Bunny status: ${response.status}`);
        }
      } catch (uploadErr) {
        console.error('[Bunny] Storage API error:', uploadErr.message);
        if (!res.writableEnded) res.status(500).json({ error: `Upload error: ${uploadErr.message}` });
      }
      resolve();
    });
  });
};

export default handler;
