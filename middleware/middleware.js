import { NextResponse } from 'next/server';

export function middleware(request) {
  // Obtener el origen de la request
  const origin = request.headers.get('origin') || '';
  
  // Permitir origins específicos (desarrollo)
  const allowedOrigins = [
    'http://localhost:8081',  // Admin Vue.js
    'http://localhost:8080',  // Admin alternativo
    'http://localhost:3000',  // Servidor
    'http://127.0.0.1:8081', // Admin IP local
    'http://127.0.0.1:3000'  // Servidor IP local
  ];

  // Verificar si el origen está permitido
  const isAllowedOrigin = allowedOrigins.includes(origin) || origin === '';

  // Configurar headers de CORS
  const response = NextResponse.next();

  // Headers básicos de CORS
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  // Configurar origen permitido
  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
  } else {
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:8081');
  }

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