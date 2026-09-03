import { NextResponse, type NextRequest } from 'next/server';

/**
 * Security headers for every response, plus a coarse auth gate on the page
 * routes. The real authorisation happens in each route handler — middleware
 * only checks that a token cookie is present, because verifying it here
 * would pull crypto into the edge runtime for no added safety.
 */
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isApi = pathname.startsWith('/api');
  const isPublicPage = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const hasToken = Boolean(req.cookies.get('baytna_at')?.value);

  let res: NextResponse;
  if (!isApi && !isPublicPage && !hasToken) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    res = NextResponse.redirect(url);
  } else if (!isApi && isPublicPage && hasToken && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    res = NextResponse.redirect(url);
  } else {
    res = NextResponse.next();
  }

  // 'unsafe-inline' on styles is required by Tailwind's injected styles and by
  // Next's inline style attributes; scripts stay strict apart from the two
  // inline bootstraps Next needs.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads).*)'],
};
