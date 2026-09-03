import { db } from './db';
import type { SessionUser } from './session';

/** Never write these into the trail, whatever object we are handed. */
const REDACT = new Set([
  'passwordHash', 'password', 'newPassword', 'currentPassword', 'confirmPassword',
  'twoFactorSecret', 'tokenHash', 'codeHash', 'token', 'refreshToken', 'secret',
]);

export function redact<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT.has(k) ? '[redacted]' : redact(v);
  }
  return out as T;
}

export type AuditInput = {
  actor: Pick<SessionUser, 'id' | 'name'> | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
};

/**
 * Audit writes must never break the operation they describe, so failures are
 * swallowed after being logged to stderr.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: input.actor?.id ?? null,
        actorName: input.actor?.name ?? 'system',
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        before: input.before === undefined ? undefined : (redact(input.before) as object),
        after: input.after === undefined ? undefined : (redact(input.after) as object),
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 400) ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write entry', err);
  }
}
