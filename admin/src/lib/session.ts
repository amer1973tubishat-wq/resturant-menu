import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import type { Role, User } from '@prisma/client';
import { db } from './db';
import { env, isProd } from './env';
import { signAccessToken, verifyAccessToken, type AccessClaims } from './jwt';
import { randomToken, sha256 } from './crypto';
import { issueCsrfToken, CSRF_COOKIE } from './csrf';

export const ACCESS_COOKIE = 'baytna_at';
export const REFRESH_COOKIE = 'baytna_rt';

const baseCookie = {
  httpOnly: true,
  secure: isProd, // always true in production; http on localhost would drop it
  sameSite: 'strict' as const,
  path: '/',
};

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  name: string;
  role: Role;
  sessionId: string;
  mustChangePassword: boolean;
  twoFactorPending: boolean;
};

// ------------------------------------------------------------ create

export async function createSession(
  res: NextResponse,
  user: Pick<User, 'id' | 'email' | 'username' | 'name' | 'role' | 'mustChangePassword'>,
  meta: { ip: string; userAgent: string },
  opts: { twoFactorPending?: boolean; rememberMe?: boolean } = {},
) {
  const refreshRaw = randomToken(32);
  const ttlDays = opts.rememberMe ? env.REFRESH_TOKEN_TTL_DAYS : 1;
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);

  const session = await db.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshRaw),
      ip: meta.ip,
      userAgent: meta.userAgent.slice(0, 400),
      expiresAt,
    },
  });

  const access = await signAccessToken({
    sub: user.id,
    sid: session.id,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    twoFactorPending: opts.twoFactorPending ?? false,
  });

  res.cookies.set(ACCESS_COOKIE, access, { ...baseCookie, maxAge: env.ACCESS_TOKEN_TTL_MIN * 60 });
  res.cookies.set(REFRESH_COOKIE, refreshRaw, { ...baseCookie, maxAge: ttlDays * 86_400 });
  // readable by JS on purpose — it is the half the client echoes back in a header
  res.cookies.set(CSRF_COOKIE, issueCsrfToken(session.id), {
    ...baseCookie,
    httpOnly: false,
    maxAge: ttlDays * 86_400,
  });

  return session;
}

/** Re-issue the access cookie without touching the refresh token (e.g. after 2FA or a password change). */
export async function reissueAccess(
  res: NextResponse,
  user: Pick<User, 'id' | 'role' | 'mustChangePassword'>,
  sessionId: string,
  opts: { twoFactorPending?: boolean } = {},
) {
  const access = await signAccessToken({
    sub: user.id,
    sid: sessionId,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    twoFactorPending: opts.twoFactorPending ?? false,
  });
  res.cookies.set(ACCESS_COOKIE, access, { ...baseCookie, maxAge: env.ACCESS_TOKEN_TTL_MIN * 60 });
}

// ------------------------------------------------------------ read

let lastTouch = new Map<string, number>();

/**
 * Resolves the caller from the access cookie. Returns null when the token is
 * missing, expired, forged, or its session has been revoked or gone idle —
 * a valid JWT is never sufficient on its own.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims?.sub || !claims.sid) return null;

  const session = await db.session.findUnique({
    where: { id: claims.sid },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;

  // idle timeout — independent of the refresh token's own lifetime
  const idleMs = env.IDLE_TIMEOUT_MIN * 60_000;
  if (Date.now() - session.lastSeenAt.getTime() > idleMs) {
    await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return null;
  }

  // throttle the write; one row update per request would be pure overhead
  const last = lastTouch.get(session.id) ?? 0;
  if (Date.now() - last > 60_000) {
    lastTouch.set(session.id, Date.now());
    db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }

  return {
    id: session.user.id,
    email: session.user.email,
    username: session.user.username,
    name: session.user.name,
    role: session.user.role,
    sessionId: session.id,
    // read these from the row, not the token: a forced reset must take effect
    // immediately, not when the 15-minute access token happens to expire
    mustChangePassword: session.user.mustChangePassword,
    twoFactorPending: claims.twoFactorPending === true,
  };
}

// ------------------------------------------------------------ refresh & revoke

export async function rotateRefresh(res: NextResponse, rawToken: string, meta: { ip: string; userAgent: string }) {
  const hash = sha256(rawToken);
  const existing = await db.session.findUnique({ where: { tokenHash: hash }, include: { user: true } });
  if (!existing) return null;

  // A revoked token being presented again means someone replayed a stolen
  // cookie. Kill every session for that user rather than just this one.
  if (existing.revokedAt) {
    await db.session.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }
  if (existing.expiresAt < new Date() || !existing.user.isActive) return null;

  const nextRaw = randomToken(32);
  await db.session.update({
    where: { id: existing.id },
    data: { tokenHash: sha256(nextRaw), lastSeenAt: new Date(), ip: meta.ip },
  });

  const maxAge = Math.floor((existing.expiresAt.getTime() - Date.now()) / 1000);
  res.cookies.set(REFRESH_COOKIE, nextRaw, { ...baseCookie, maxAge });
  await reissueAccess(res, existing.user, existing.id);
  return existing;
}

export async function revokeSession(sessionId: string) {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

export function clearAuthCookies(res: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
    res.cookies.set(name, '', { ...baseCookie, httpOnly: name !== CSRF_COOKIE, maxAge: 0 });
  }
}
