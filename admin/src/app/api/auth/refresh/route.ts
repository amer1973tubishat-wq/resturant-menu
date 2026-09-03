import { NextRequest, NextResponse } from 'next/server';
import { rotateRefresh, REFRESH_COOKIE, clearAuthCookies } from '@/lib/session';
import { getIp, getUa, fail } from '@/lib/api';

/**
 * Rotates the refresh token. Presenting an already-rotated token is treated
 * as theft and kills every session for that user (see rotateRefresh).
 */
export async function POST(req: NextRequest) {
  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!raw) return fail('No refresh token', 401, 'NO_REFRESH');

  const res = NextResponse.json({ ok: true });
  const session = await rotateRefresh(res, raw, { ip: getIp(req), userAgent: getUa(req) });
  if (!session) {
    const bad = NextResponse.json({ error: 'Session expired', code: 'REFRESH_INVALID' }, { status: 401 });
    clearAuthCookies(bad);
    return bad;
  }
  return res;
}
