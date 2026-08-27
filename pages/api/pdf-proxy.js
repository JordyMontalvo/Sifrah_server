import http from 'http';
import https from 'https';
import dns from 'dns';
import net from 'net';
import { promisify } from 'util';
import lib from '../../components/lib';

const { midd } = lib;
const lookup = promisify(dns.lookup);

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

function applyCorsExpose(res) {
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Accept-Ranges, Content-Range, Content-Length, Content-Type'
  );
}

function fetchPdfStream(rawUrl, extraHeaders, depth = 0) {
  return new Promise(async (resolve, reject) => {
    try {
      if (depth > MAX_REDIRECTS) throw new Error('demasiadas redirecciones');

      const target = new URL(rawUrl);
      await assertPublicTarget(target);

      const client = target.protocol === 'https:' ? https : http;
      const req = client.request(
        target,
        {
          method: extraHeaders.method || 'GET',
          headers: extraHeaders.headers,
        },
        (upstream) => {
          if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
            upstream.resume();
            fetchPdfStream(
              new URL(upstream.headers.location, target).toString(),
              extraHeaders,
              depth + 1
            ).then(resolve, reject);
            return;
          }
          resolve(upstream);
        }
      );

      req.on('error', reject);
      req.setTimeout(30000, () => req.destroy(new Error('timeout')));
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export default async function handler(req, res) {
  await midd(req, res);
  applyCorsExpose(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  const range = req.headers.range;
  const headers = {
    'User-Agent': BROWSER_UA,
    Accept: 'application/pdf,application/octet-stream,*/*',
  };
  if (range) headers.Range = range;

  let upstream;
  try {
    upstream = await fetchPdfStream(normalizePdfUrl(url), {
      method: req.method,
      headers,
    });
  } catch (error) {
    console.error('PDF Proxy Error:', error.message);
    return res.status(400).json({ error: 'Failed to fetch PDF' });
  }

  if (upstream.statusCode >= 400) {
    upstream.resume();
    return res.status(400).json({ error: 'Failed to fetch PDF' });
  }

  res.status(upstream.statusCode);
  res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/pdf');
  res.setHeader('Accept-Ranges', 'bytes');
  if (upstream.headers['content-length']) {
    res.setHeader('Content-Length', upstream.headers['content-length']);
  }
  if (upstream.headers['content-range']) {
    res.setHeader('Content-Range', upstream.headers['content-range']);
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (req.method === 'HEAD') {
    upstream.resume();
    return res.end();
  }

  upstream.pipe(res);
}
