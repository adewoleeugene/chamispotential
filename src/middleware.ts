import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PAGES = ['/login', '/change-password', '/payments/monime/success', '/payments/monime/cancel'];
const PUBLIC_API = ['/api/auth/login', '/api/auth/logout', '/api/webhooks/'];

function isPublicPage(pathname: string) {
  return pathname === '/' || PUBLIC_PAGES.some(p => pathname.startsWith(p));
}

function isPublicApi(pathname: string) {
  return PUBLIC_API.some(p => pathname.startsWith(p));
}

function isApiRoute(pathname: string) {
  return pathname.startsWith('/api/');
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('rms-token')?.value;

  // --- CSRF protection for state-changing API requests ---
  if (isApiRoute(pathname) && !isPublicApi(pathname)) {
    const method = req.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const hasCustomHeader = req.headers.get('x-requested-with') === 'XMLHttpRequest';
      const isJson = req.headers.get('content-type')?.includes('application/json');
      if (!hasCustomHeader && !isJson) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
  }

  // --- Route protection: redirect unauthenticated page visits ---
  if (!token && !isPublicPage(pathname) && !isApiRoute(pathname)) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js).*)'],
};
