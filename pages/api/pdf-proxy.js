import axios from 'axios';
import dns from 'dns';
import net from 'net';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

const MAX_BYTES = 60 * 1024 * 1024;
const MAX_REDIRECTS = 3;

// Sin este filtro el proxy descarga cualquier URL que le pidan desde la red del
// servidor: el endpoint de metadatos del cloud (169.254.169.254), servicios que
// solo escuchan en localhost o cualquier host de la red privada.
function isInternalAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }

  const ip6 = ip.toLowerCase();
  if (ip6.startsWith('::ffff:')) return isInternalAddress(ip6.slice(7));
  if (ip6 === '::' || ip6 === '::1') return true;
  return ip6.startsWith('fc') || ip6.startsWith('fd') || ip6.startsWith('fe80');
}

async function assertPublicTarget(target) {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('protocolo no permitido');
  }

  const { address } = await lookup(target.hostname);
  if (isInternalAddress(address)) throw new Error('destino no permitido');
}

// Seguimos las redirecciones a mano para validar cada salto: delegarlas en axios
// permitiria que un host publico redirija hacia una direccion interna.
async function fetchPdf(rawUrl, depth = 0) {
  if (depth > MAX_REDIRECTS) throw new Error('demasiadas redirecciones');

  const target = new URL(rawUrl);
  await assertPublicTarget(target);

  const response = await axios.get(target.toString(), {
    responseType: 'arraybuffer',
    timeout: 20000,
    maxRedirects: 0,
    maxContentLength: MAX_BYTES,
    validateStatus: (status) => status >= 200 && status < 400,
    headers: { 'User-Agent': 'Sifrah-Proxy/1.0' },
  });

  const location = response.headers && response.headers.location;
  if (response.status >= 300 && location) {
    return fetchPdf(new URL(location, target).toString(), depth + 1);
  }

  return response;
}

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  let response;
  try {
    response = await fetchPdf(url);
  } catch (error) {
    // Sin detalles en la respuesta: convertirian el proxy en un escaner de la red interna.
    console.error('PDF Proxy Error:', error.message);
    return res.status(400).json({ error: 'Failed to fetch PDF' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', response.data.length);

  // Cache the response for 1 hour to save bandwidth
  res.setHeader('Cache-Control', 'public, max-age=3600');

  return res.send(Buffer.from(response.data));
}
