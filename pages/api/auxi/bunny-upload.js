const busboy = require('busboy');
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

  const bb = busboy({ headers: req.headers });
  let fileName = '';
  let dir = 'general';
  let uploadStarted = false;
  let uploadError = null;

  const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
  const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
  const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
  const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

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

  return new Promise((resolve) => {
    bb.on('field', (name, val) => {
      if (name === 'fileName') fileName = val;
      if (name === 'dir') dir = val;
    });

    bb.on('file', async (name, file, info) => {
      // In busboy 1.0+, info is an object { filename, encoding, mimeType }
      const originalFilename = info.filename;
      const mimeType = info.mimeType;
      
      const finalFileName = fileName || originalFilename;
      const targetFolder = folderMapping[dir] || dir;
      const path = `${targetFolder}/${finalFileName}`;

      if (!storageZoneName || !storagePassword || !pullZoneUrl) {
        uploadError = 'Bunny.net configuration missing in .env';
        file.resume();
        return;
      }

      uploadStarted = true;

      try {
        const response = await axios({
          method: 'put',
          url: `https://${storageHostname}/${storageZoneName}/${path}`,
          headers: {
            'AccessKey': storagePassword,
            'Content-Type': mimeType || 'application/octet-stream',
          },
          data: file, // Direct stream
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        if (response.status === 201 || response.status === 200) {
          const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
          res.json({ url: `${basePullUrl}${path}` });
        } else {
          throw new Error(`Bunny.net error: ${response.statusText}`);
        }
      } catch (err) {
        console.error('Error uploading to Bunny.net:', err.message);
        uploadError = `Error uploading to Bunny.net: ${err.message}`;
        if (!res.headersSent) res.status(500).json({ error: uploadError });
      }
      resolve();
    });

    bb.on('finish', () => {
      if (!uploadStarted && !res.headersSent) {
        res.status(400).json({ error: uploadError || 'No file uploaded' });
      }
      resolve();
    });

    bb.on('error', (err) => {
      console.error('Busboy error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Error processing upload stream' });
      resolve();
    });

    req.pipe(bb);
  });
};

module.exports = cors(handler);
