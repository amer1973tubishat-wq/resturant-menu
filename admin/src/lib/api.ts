import { NextRequest, NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { getSession, type SessionUser } from './session';
import { can, type Permission } from './rbac';
import { rateLimit, type LIMITS } from './rate-limit';
import { verifyCsrfToken, CSRF_HEADER } from './csrf';

export type Ctx<P = unknown> = {
  user: SessionUser;
  ip: string;
  userAgent: string;
  req: NextRequest;
  params: P;
};

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init);
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * Trust the proxy header only for the left-most entry, and only because this
 * app is expected to sit behind one. Behind no proxy this falls back to the
 * connection address.
 */
export function getIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? '0.0.0.0';
}

export function getUa(req: NextRequest): string {
  return req.headers.get('user-agent') ?? 'unknown';
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type GuardOptions = {
  permission?: Permission;
  limit?: (typeof LIMITS)[keyof typeof LIMITS];
  /** Set for the handful of endpoints whose job is to clear these very states. */
  allowWhilePasswordChangePending?: boolean;
  allowWhileTwoFactorPending?: boolean;
  skipCsrf?: boolean;
};

/**
 * Every authenticated route goes through here. The order matters: rate limit
 * before touching the database, then identity, then the two "incomplete
 * login" gates, then CSRF, then the permission check.
 */
export function withAuth<P = unknown>(
  opts: GuardOptions,
  handler: (ctx: Ctx<P>) => Promise<Response>,
) {
  return async (req: NextRequest, route?: { params: P }): Promise<Response> => {
    const ip = getIp(req);

    if (opts.limit) {
      const r = rateLimit(`${req.nextUrl.pathname}:${ip}`, opts.limit.limit, opts.limit.windowMs);
      if (!r.allowed) {
        return NextResponse.json(
          { error: 'Too many requests. Try again shortly.', code: 'RATE_LIMITED' },
          { status: 429, headers: { 'Retry-After': String(r.retryAfterSec) } },
        );
      }
    }

    const user = await getSession();
    if (!user) return fail('Authentication required', 401, 'UNAUTHENTICATED');

    if (user.twoFactorPending && !opts.allowWhileTwoFactorPending) {
      return fail('Two-factor verification required', 403, 'TWO_FACTOR_REQUIRED');
    }
    if (user.mustChangePassword && !opts.allowWhilePasswordChangePending) {
      return fail('You must set a new password before continuing', 403, 'PASSWORD_CHANGE_REQUIRED');
    }

    if (MUTATING.has(req.method) && !opts.skipCsrf) {
      const token = req.headers.get(CSRF_HEADER);
      if (!verifyCsrfToken(token, user.sessionId)) {
        return fail('Invalid or missing CSRF token', 403, 'CSRF_FAILED');
      }
    }

    if (opts.permission && !can(user.role, opts.permission)) {
      return fail('You do not have permission to do that', 403, 'FORBIDDEN');
    }

    try {
      return await handler({ user, ip, userAgent: getUa(req), req, params: (route?.params ?? {}) as P });
    } catch (err) {
      return handleError(err);
    }
  };
}

/** For the unauthenticated endpoints (login, reset) that still need limiting. */
export function withPublic(
  opts: { limit?: (typeof LIMITS)[keyof typeof LIMITS] },
  handler: (req: NextRequest, ip: string) => Promise<Response>,
) {
  return async (req: NextRequest): Promise<Response> => {
    const ip = getIp(req);
    if (opts.limit) {
      const r = rateLimit(`${req.nextUrl.pathname}:${ip}`, opts.limit.limit, opts.limit.windowMs);
      if (!r.allowed) {
        return NextResponse.json(
          { error: 'Too many requests. Try again shortly.', code: 'RATE_LIMITED' },
          { status: 429, headers: { 'Retry-After': String(r.retryAfterSec) } },
        );
      }
    }
    try {
      return await handler(req, ip);
    } catch (err) {
      return handleError(err);
    }
  };
}

function handleError(err: unknown): Response {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 422 },
    );
  }
  // Never leak a stack trace or a Prisma message to the client.
  console.error('[api] unhandled error', err);
  return NextResponse.json({ error: 'Something went wrong', code: 'INTERNAL' }, { status: 500 });
}

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ZodError([{ code: 'custom', path: ['body'], message: 'Body must be valid JSON' }]);
  }
  return schema.parse(raw);
}
