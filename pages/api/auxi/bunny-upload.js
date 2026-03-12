import https from 'https';
import formidable from 'formidable';
const { applyCORS } = require('../../../middleware/middleware-cors');

export const config = {
  api: {
    bodyParser: false, // Formidable lo manejará
    externalResolver: true,
  },
};

const handler = (req, res) => {
  applyCORS(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const form = formidable({ 
    multiples: false,
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024 // 50MB
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[Bunny-Form] Formidable error:', err);
      return res.status(500).json({ error: 'Error procesando formulario' });
    }

    const { fileName, dir } = fields;
    const file = files.file;

    if (!file || !fileName) {
      console.error('[Bunny-Form] Missing file or fileName in body');
      return res.status(400).json({ error: 'Falta archivo o nombre' });
    }

    const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
    const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
    const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'br.storage.bunnycdn.com';
    const pullZoneUrl = 'https://sifraht.b-cdn.net/';

    const folderMapping = {
      'perfil': 'perfiles', 'photos': 'perfiles', 'audios': 'audios',
      'product': 'productos', 'banner': 'banners', 'flyer': 'flyers'
    };
    const targetFolder = folderMapping[dir] || dir;
    const path = `${targetFolder}/${fileName}`;
    const bunnyUrl = `https://${storageHostname}/${storageZoneName}/${path}`;

    console.log(`[Bunny-Form] Uploading ${fileName} to ${targetFolder}`);

    // Leer el archivo temporal creado por formidable y mandarlo a Bunny
    const fs = require('fs');
    const fileStream = fs.createReadStream(file.filepath);

    const bunnyReq = https.request(bunnyUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': storagePassword,
        'Content-Type': file.mimetype || 'application/octet-stream',
        'Content-Length': file.size
      }
    }, (bunnyRes) => {
      let responseData = '';
      bunnyRes.on('data', d => responseData += d);
      bunnyRes.on('end', () => {
        // Eliminar archivo temporal después del proceso
        fs.unlink(file.filepath, () => {});

        if (bunnyRes.statusCode === 201 || bunnyRes.statusCode === 200) {
          console.log(`[Bunny-Form] Success: ${path}`);
          res.status(200).json({ url: `${pullZoneUrl}${path}` });
        } else {
          console.error(`[Bunny-Form] Bunny Error ${bunnyRes.statusCode}: ${responseData}`);
          res.status(500).json({ error: `Bunny Error: ${bunnyRes.statusCode}` });
        }
      });
    });

    bunnyReq.on('error', e => {
      fs.unlink(file.filepath, () => {});
      console.error('[Bunny-Form] Connection Error:', e.message);
      res.status(500).json({ error: 'Error de red con Bunny' });
    });

    fileStream.pipe(bunnyReq);
  });
};

export default handler;
