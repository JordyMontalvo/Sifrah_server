require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const config = require('./config/config-heroku');

const dev = config.nodeEnv !== 'production';
const hostname = config.host;
const port = config.port;

// Preparar la aplicación Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      // Parsear la URL
      const parsedUrl = parse(req.url, true);
      
      // Log de la solicitud
      if (config.enableLogs) {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      }
      
      // Manejar la solicitud
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });
  
  // Configurar timeouts para Heroku
  server.timeout = config.serverTimeout;
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  
  server
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Environment: ${config.nodeEnv}`);
      console.log(`> Port: ${port}`);
      console.log(`> Host: ${hostname}`);
      console.log(`> Timeout: ${config.serverTimeout}ms`);
    });
});