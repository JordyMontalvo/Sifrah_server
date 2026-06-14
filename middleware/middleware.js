import { NextResponse } from 'next/server';

const productionFallbacks = [];
if (process.env.NODE_ENV === 'production') {
  if (!process.env.FRONTEND_URL) productionFallbacks.push('https://sifrah.vercel.app');
  if (!process.env.ADMIN_URL) productionFallbacks.push('https://sifrah-admin.vercel.app');
}

export function middleware(request) {
  const origin = request.headers.get('origin') || '';
  
  const allowedOrigins = [
    'http://localhost:8081',
    'http://localhost:8080',
    'http://localhost:3000',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ...(process.env.ADMIN_URL ? [process.env.ADMIN_URL] : []),
    ...(process.env.BACKEND_URL ? [process.env.BACKEND_URL] : []),
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()) : []),
    ...productionFallbacks,
  ];

  const isAllowedOrigin = allowedOrigins.includes(origin);
  const isProduction = process.env.NODE_ENV === 'production';

  const response = NextResponse.next();

  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, sentry-trace, baggage');
  
  if (origin && isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (!isProduction) {
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