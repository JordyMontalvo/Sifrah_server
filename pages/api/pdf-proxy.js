import axios from 'axios';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Fetch the PDF from the CDN
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Sifrah-Proxy/1.0'
      }
    });

    // Set CORS headers so the frontend can read the response
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', response.data.length);

    // Cache the response for 1 hour to save bandwidth
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Send the data
    return res.send(Buffer.from(response.data));

  } catch (error) {
    console.error('PDF Proxy Error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch PDF', details: error.message });
  }
}
