const formidable = require('formidable');
const fs = require('fs');
const axios = require('axios');
const cors = require('micro-cors')();

export const config = {
  api: {
    bodyParser: false,
  },
};

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new formidable.IncomingForm({ 
    keepExtensions: true,
    multiples: false
  });

  return new Promise((resolve, reject) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Error parsing form:', err);
        res.status(500).json({ error: 'Error parsing form' });
        return resolve();
      }

      const file = files.file instanceof Array ? files.file[0] : files.file;
      const fileName = fields.fileName || file.originalFilename;
      const dir = fields.dir || 'general';

      const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
      const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
      const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
      const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

      if (!storageZoneName || !storagePassword || !pullZoneUrl) {
          res.status(500).json({ error: 'Bunny.net configuration missing in .env' });
          return resolve();
      }

      // map internal directory names to Bunny folders
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
            'Content-Type': 'application/octet-stream',
          },
          data: fileContent,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        if (response.status === 201 || response.status === 200) {
          const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
          const finalUrl = `${basePullUrl}${path}`;
          res.json({ url: finalUrl });
        } else {
          throw new Error(`Bunny.net error: ${response.statusText}`);
        }
      } catch (uploadErr) {
        console.error('Error uploading to Bunny.net:', uploadErr.message);
        res.status(500).json({ error: `Error uploading to Bunny.net: ${uploadErr.message}` });
      }
      resolve();
    });
  });
};

module.exports = cors(handler);
