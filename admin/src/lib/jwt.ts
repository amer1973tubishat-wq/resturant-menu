import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from './env';
import type { Role } from '@prisma/client';

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ISSUER = 'baytna-admin';
const AUDIENCE = 'baytna-admin-api';

/**
 * Declared separately from JWTPayload: that type carries a string index
 * signature, so `Omit<AccessClaims, keyof JWTPayload>` would erase every
 * field rather than just the registered claims.
 */
export type AccessClaimsData = {
  sub: string;
  sid: string; // session id, so a revoked session kills the access token too
  role: Role;
  /** true until the user clears the forced-change screen */
  mustChangePassword: boolean;
  /** true between password check and TOTP check — grants nothing else */
  twoFactorPending: boolean;
};

export type AccessClaims = JWTPayload & AccessClaimsData;

export async function signAccessToken(claims: AccessClaimsData) {
  return new SignJWT(claims as JWTPayload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MIN}m`)
    .sign(accessKey);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'], // pin it — never trust the token's own alg header
    });
    return payload as AccessClaims;
  } catch {
    return null;
  }
}
