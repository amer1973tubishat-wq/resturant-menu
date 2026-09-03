import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { encrypt, decrypt } from './crypto';

// one step of drift either way — tolerates clock skew without widening
// the window enough to make replay practical
authenticator.options = { window: 1, step: 30 };

const ISSUER = 'Baytna Burger Admin';

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function otpAuthUrl(secret: string, account: string): string {
  return authenticator.keyuri(account, ISSUER, secret);
}

export function qrDataUrl(otpauth: string): Promise<string> {
  return QRCode.toDataURL(otpauth, { margin: 1, width: 240 });
}

export function verifyTotp(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ''), secret });
  } catch {
    return false;
  }
}

/** The stored secret is always encrypted; these are the only two doors. */
export const sealSecret = encrypt;
export const openSecret = decrypt;
