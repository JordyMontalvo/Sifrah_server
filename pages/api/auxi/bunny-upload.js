import formidable from 'formidable';
import fs from 'fs';
import axios from 'axios';
import cors_lib from 'micro-cors';
const cors = cors_lib();

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

const handler = async (req, res) => {
  console.log('Incoming upload request to /api/auxi/bunny-upload');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new formidable.IncomingForm({
    keepExtensions: true,
    multiples: false,
  });

  return new Promise((resolve) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Formidable error:', err.message);
        res.status(500).json({ error: 'Error processing upload' });
        return resolve();
      }

      const file = files.file instanceof Array ? files.file[0] : files.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return resolve();
      }

      const fileName = fields.fileName || file.originalFilename || file.name;
      const dir = fields.dir || 'general';

      const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
      const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
      const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
      const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

      if (!storageZoneName || !storagePassword || !pullZoneUrl) {
          res.status(500).json({ error: 'Bunny configuration missing' });
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
        'plan': 'planes'
      };

      const targetFolder = folderMapping[dir] || dir;
      const path = `${targetFolder}/${fileName}`;

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
          res.json({ url: `${basePullUrl}${path}` });
        } else {
          throw new Error(`Bunny.net error: ${response.statusText}`);
        }
      } catch (uploadErr) {
        console.error('Error uploading to Bunny.net:', uploadErr.message);
        res.status(500).json({ error: `Upload error: ${uploadErr.message}` });
      }
      resolve();
    });
  });
};

export default cors(handler);
