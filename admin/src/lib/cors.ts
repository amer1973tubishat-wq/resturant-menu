import { NextResponse, type NextRequest } from 'next/server';
import { env } from './env';

/**
 * Only the public site may read these endpoints from a browser. The origin is
 * echoed back only when it matches exactly — never reflected blindly, which
 * would defeat the point of having CORS at all.
 */
const allowed = new Set([env.PUBLIC_SITE_URL, env.APP_URL].map((u) => u.replace(/\/$/, '')));

export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin');
  if (!origin || !allowed.has(origin.replace(/\/$/, ''))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function withCors(req: NextRequest, res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  return res;
}

export function preflight(req: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}
