import crypto from 'node:crypto';
import { env } from './env';
import { timingSafeEqual } from './crypto';

/**
 * Signed double-submit token. SameSite=Strict already blocks the classic
 * cross-site POST, but a token defends against same-site subdomain takeover
 * and is what the spec asks for.
 *
 * Format: <random>.<hmac(random + sessionId)>
 */
export const CSRF_COOKIE = 'baytna_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function issueCsrfToken(sessionId: string): string {
  const nonce = crypto.randomBytes(18).toString('base64url');
  const mac = crypto.createHmac('sha256', env.CSRF_SECRET).update(`${nonce}.${sessionId}`).digest('base64url');
  return `${nonce}.${mac}`;
}

export function verifyCsrfToken(token: string | null | undefined, sessionId: string): boolean {
  if (!token) return false;
  const [nonce, mac] = token.split('.');
  if (!nonce || !mac) return false;
  const expected = crypto.createHmac('sha256', env.CSRF_SECRET).update(`${nonce}.${sessionId}`).digest('base64url');
  return timingSafeEqual(mac, expected);
}
