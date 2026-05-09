/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración para Heroku
  env: {
    PORT: process.env.PORT || 3000,
  },
  
  // Configuración del servidor
  serverRuntimeConfig: {
    port: process.env.PORT || 3000,
  },
  
  async headers() {
    return [
      {
        // matching all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          // El origen debe ser manejado dinámicamente por el middleware de CORS para mayor seguridad
          // { key: "Access-Control-Allow-Origin", value: "*" }, 
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,DELETE,PATCH,POST,PUT,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, sentry-trace, baggage",
          },
          // Cabeceras de seguridad adicionales
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Powered-By", value: "Sifrah Engine" } // Ofuscación de stack
        ],
      },
    ];
  },
};

module.exports = nextConfig;
