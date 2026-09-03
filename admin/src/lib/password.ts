import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from './env';

/**
 * Argon2id at OWASP's recommended floor (19 MiB, t=2, p=1).
 * Memory cost is what makes GPU cracking expensive, so do not lower it.
 */
// The package exports Algorithm as an ambient const enum, which isolatedModules
// forbids importing, so the value is written out. 2 === Algorithm.Argon2id.
const ARGON2ID = 2;

const ARGON_OPTS = {
  algorithm: ARGON2ID,
  memoryCost: 19456, // KiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argonHash(plain, ARGON_OPTS);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await argonVerify(hashed, plain);
  } catch {
    // malformed hash in the row — treat as a failed attempt, never as a pass
    return false;
  }
}

// ---------------------------------------------------------------- policy

export const PASSWORD_MIN = 12;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(200, 'Password is too long')
  .refine((v) => /[a-z]/.test(v), 'Must contain a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Must contain an uppercase letter')
  .refine((v) => /[0-9]/.test(v), 'Must contain a number')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Must contain a symbol');

export type PasswordCheck = {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  errors: string[];
  breached?: boolean;
};

/**
 * Have I Been Pwned k-anonymity: we send only the first 5 characters of the
 * SHA-1, so the full hash (and therefore the password) never leaves this
 * process. A network failure must not block a legitimate password change,
 * so an unreachable API is treated as "not known to be breached".
 */
export async function isBreached(plain: string): Promise<boolean | undefined> {
  if (env.HIBP_ENABLED !== 'true') return undefined;
  const sha1 = crypto.createHash('sha1').update(plain).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'baytna-admin' },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return undefined;
    const body = await res.text();
    for (const line of body.split('\n')) {
      const [hashSuffix, count] = line.trim().split(':');
      if (hashSuffix === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return undefined; // fail open — availability over a best-effort check
  }
}

/** Cheap entropy estimate for the strength meter (not a security control). */
export function strengthScore(v: string): 0 | 1 | 2 | 3 | 4 {
  let score = 0;
  if (v.length >= PASSWORD_MIN) score++;
  if (v.length >= 16) score++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
  if (/[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
  // long runs of one character or an obvious sequence should not read as strong
  if (/(.)\1{3,}/.test(v) || /(?:abc|123|qwe|password|admin)/i.test(v)) score = Math.max(0, score - 2);
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

export async function checkPassword(plain: string, opts: { checkBreach?: boolean } = {}): Promise<PasswordCheck> {
  const parsed = passwordSchema.safeParse(plain);
  const errors = parsed.success ? [] : parsed.error.issues.map((i) => i.message);
  let breached: boolean | undefined;
  if (opts.checkBreach !== false && errors.length === 0) {
    breached = await isBreached(plain);
    if (breached) errors.push('This password has appeared in a known data breach — choose another');
  }
  return { ok: errors.length === 0, score: strengthScore(plain), errors, breached };
}

/** Backup codes: shown once at generation, stored only as Argon2id hashes. */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}
