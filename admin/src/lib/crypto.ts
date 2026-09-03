import crypto from 'node:crypto';
import { env } from './env';

const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');
const IV_LEN = 12; // GCM standard
const TAG_LEN = 16;

/** AES-256-GCM. Output is base64: iv | tag | ciphertext. */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** For opaque tokens we must look up by value — hash, never store raw. */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Constant-time compare that will not throw on length mismatch. */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // still burn a comparison so the failure cost does not leak length
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

/** Device fingerprint for "new sign-in location" alerts. */
export function deviceFingerprint(userAgent: string, ip: string): string {
  return sha256(`${userAgent}|${ip.split('.').slice(0, 3).join('.')}`);
}
