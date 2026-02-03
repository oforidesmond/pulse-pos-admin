import { NextRequest, NextResponse } from 'next/server';

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowAllOrigins = !allowedOrigins || allowedOrigins.length === 0;

function applyCorsHeaders(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get('origin');
  const requestHeaders = request.headers.get('access-control-request-headers');

  const originToSet = allowAllOrigins
    ? '*'
    : origin && allowedOrigins!.includes(origin)
      ? origin
      : null;

  if (originToSet) {
    response.headers.set('Access-Control-Allow-Origin', originToSet);
    if (originToSet !== '*') {
      response.headers.append('Vary', 'Origin');
    }
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', requestHeaders ?? 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
}

export function middleware(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    const preflight = new NextResponse(null, { status: 204 });
    applyCorsHeaders(request, preflight);
    return preflight;
  }

  const response = NextResponse.next();
  applyCorsHeaders(request, response);
  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
