import { NextResponse } from 'next/server';

export function middleware(request) {
  // Obtener el origen de la request
  const origin = request.headers.get('origin') || '';
  
  // Permitir origins específicos (desarrollo)
  const allowedOrigins = [
    'http://localhost:8081',  // Admin Vue.js
    'http://localhost:8080',  // Admin alternativo
    'http://localhost:3000',  // Servidor
  ];

  // Solo permitir orígenes en desarrollo o si son explícitamente confiables
  const isAllowedOrigin = allowedOrigins.includes(origin);
  const isProduction = process.env.NODE_ENV === 'production';

  // Configurar headers de CORS
  const response = NextResponse.next();

  // Headers básicos de CORS
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, sentry-trace, baggage');
  
  // Configurar origen permitido de forma estricta
  if (origin && isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (!isProduction) {
    // En desarrollo, fallback a localhost
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:8081');
  }
  // En producción, si no está en allowedOrigins, no se envía el header (bloqueo por CORS)

  // Manejar preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: response.headers,
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
}; 