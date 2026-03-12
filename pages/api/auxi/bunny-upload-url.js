const { applyCORS } = require('../../../middleware/middleware-cors');

// Este endpoint NO toca el archivo.
// Solo genera la URL de destino a donde el cliente subirá directamente.
export default async function handler(req, res) {
  applyCORS(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { fileName, dir } = req.body;

  if (!fileName || !dir) {
    return res.status(400).json({ error: 'Faltan fileName o dir' });
  }

  const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME || 'sifrah';
  const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'br.storage.bunnycdn.com';
  const pullZoneUrl = (process.env.BUNNY_PULL_ZONE_URL || 'https://sifraht.b-cdn.net').replace(/\/$/, '');

  const folderMapping = {
    'perfil': 'perfiles', 'photos': 'perfiles', 'audios': 'audios',
    'product': 'productos', 'banner': 'banners', 'flyer': 'flyers'
  };
  const targetFolder = folderMapping[dir] || dir;

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${targetFolder}/${safeFileName}`;

  const uploadUrl = `https://${storageHostname}/${storageZoneName}/${path}`;
  const publicUrl = `${pullZoneUrl}/${path}`;

  console.log(`[BunnyURL] Generated upload URL for: ${path}`);

  res.status(200).json({ uploadUrl, publicUrl });
}
