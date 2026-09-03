import { db } from './db';

/**
 * In-process sliding window. Good enough for a single node; swap the store
 * for Redis before running more than one instance, or the limit becomes
 * per-instance rather than global.
 */
type Bucket = { hits: number[]; };
const buckets = new Map<string, Bucket>();

// keep the map from growing without bound on a long-lived process
let lastSweep = Date.now();
function sweep(windowMs: number) {
  if (Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  const cutoff = Date.now() - windowMs;
  for (const [key, b] of buckets) {
    b.hits = b.hits.filter((t) => t > cutoff);
    if (b.hits.length === 0) buckets.delete(key);
  }
}

export type RateResult = { allowed: boolean; remaining: number; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  sweep(windowMs);
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0] ?? now;
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((oldest + windowMs - now) / 1000) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 };
}

export const LIMITS = {
  /**
   * Deliberately loose. Staff share one office IP, so a tight per-IP limit
   * locks out the whole team rather than an attacker. Precise brute-force
   * defence is the per-account lockout below, which an IP rotation cannot
   * evade; this limit only stops volumetric abuse from a single source.
   */
  login: { limit: 40, windowMs: 15 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  twoFactor: { limit: 10, windowMs: 15 * 60_000 },
  upload: { limit: 30, windowMs: 60_000 },
  write: { limit: 120, windowMs: 60_000 },
} as const;

/**
 * Per-account lockout, separate from per-IP rate limiting: an attacker
 * rotating IPs still trips this. Backoff doubles with each extra failure
 * beyond the threshold, capped at 60 minutes.
 */
export function lockoutDuration(failedAttempts: number, threshold: number): number {
  if (failedAttempts < threshold) return 0;
  const over = failedAttempts - threshold;
  return Math.min(60, 5 * Math.pow(2, over)); // minutes: 5, 10, 20, 40, 60...
}

export async function recordLoginAttempt(email: string, ip: string, success: boolean) {
  await db.loginAttempt.create({ data: { email: email.toLowerCase(), ip, success } });
}
