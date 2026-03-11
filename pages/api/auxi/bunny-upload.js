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
    let bb;
    try {
      bb = busboy({ headers: req.headers });
    } catch (e) {
      res.status(400).json({ error: 'Invalid request' });
      return resolve();
    }

    let fileName = '';
    let dir = 'general';
    let uploadPromise = null;
    let isFinished = false;

    bb.on('field', (name, val) => {
      if (name === 'fileName') fileName = val;
      if (name === 'dir') dir = val;
    });

    bb.on('file', (name, file, info) => {
      // Handle both busboy 0.x and 1.x
      const originalFilename = typeof info === 'string' ? info : (info && info.filename);
      const mimeType = (info && info.mimeType) || (typeof info === 'object' && info.mimetype);
      
      const finalFileName = fileName || originalFilename;
      const targetFolder = folderMapping[dir] || dir;
      const path = `${targetFolder}/${finalFileName}`;

      if (!storageZoneName || !storagePassword || !pullZoneUrl) {
        file.resume();
        if (!res.headersSent) res.status(500).json({ error: 'Bunny configuration missing' });
        return;
      }

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
      }).then((response) => {
        if (!res.headersSent) {
          const basePullUrl = pullZoneUrl.endsWith('/') ? pullZoneUrl : `${pullZoneUrl}/`;
          res.json({ url: `${basePullUrl}${path}` });
        }
      }).catch((err) => {
        console.error('Error uploading to Bunny.net:', err.message);
        if (!res.headersSent) res.status(500).json({ error: `Upload error: ${err.message}` });
      });
    });

    bb.on('finish', async () => {
      isFinished = true;
      if (uploadPromise) await uploadPromise;
      if (!res.headersSent) {
        res.status(400).json({ error: 'No file uploaded' });
      }
      resolve();
    });

    bb.on('error', (err) => {
      console.error('Busboy error:', err.message);
      if (err.message === 'Unexpected end of form' && res.headersSent) {
        // We already responded success, can safely ignore
        return resolve();
      }
      if (!res.headersSent) res.status(500).json({ error: 'Upload process failed' });
      resolve();
    });

    req.pipe(bb);
  });
};

module.exports = cors(handler);
