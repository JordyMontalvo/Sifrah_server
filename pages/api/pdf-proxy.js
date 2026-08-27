import axios from 'axios';
import dns from 'dns';
import net from 'net';
import { promisify } from 'util';
import lib from '../../components/lib';

const { midd } = lib;
const lookup = promisify(dns.lookup);

const MAX_BYTES = 60 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

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

function normalizePdfUrl(rawUrl) {
  const target = new URL(rawUrl);
  if (target.hostname.includes('drive.google.com')) {
    const id =
      (target.pathname.match(/\/d\/([^/]+)/) || [])[1] ||
      target.searchParams.get('id');
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  return target.toString();
}

async function fetchPdf(rawUrl, depth = 0) {
  if (depth > MAX_REDIRECTS) throw new Error('demasiadas redirecciones');

  const target = new URL(rawUrl);
  await assertPublicTarget(target);

  const response = await axios.get(target.toString(), {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxRedirects: 0,
    maxContentLength: MAX_BYTES,
    validateStatus: (status) => status >= 200 && status < 400,
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'application/pdf,application/octet-stream,*/*',
    },
  });

  const location = response.headers && response.headers.location;
  if (response.status >= 300 && location) {
    return fetchPdf(new URL(location, target).toString(), depth + 1);
  }

  return response;
}

function isPdfBuffer(buf) {
  if (!buf || buf.length < 5) return false;
  return buf.slice(0, 5).toString('utf8') === '%PDF-';
}

export default async function handler(req, res) {
  await midd(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  let response;
  try {
    response = await fetchPdf(normalizePdfUrl(url));
  } catch (error) {
    console.error('PDF Proxy Error:', error.message);
    return res.status(400).json({ error: 'Failed to fetch PDF' });
  }

  const buf = Buffer.from(response.data);
  if (!isPdfBuffer(buf)) {
    console.error('PDF Proxy Error: respuesta no es PDF');
    return res.status(400).json({ error: 'Failed to fetch PDF' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', buf.length);
  res.setHeader('Accept-Ranges', 'none');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  return res.send(buf);
}
