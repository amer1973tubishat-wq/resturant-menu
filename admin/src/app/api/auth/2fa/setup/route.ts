import { db } from '@/lib/db';
import { json, withAuth, fail } from '@/lib/api';
import { generateSecret, otpAuthUrl, qrDataUrl, sealSecret } from '@/lib/totp';

/**
 * Generates a secret and returns the QR. The secret is stored encrypted but
 * twoFactorEnabled stays false until /enable confirms the user can produce a
 * valid code — otherwise a mis-scanned QR would lock them out.
 */
export const POST = withAuth({}, async ({ user }) => {
  const row = await db.user.findUnique({ where: { id: user.id } });
  if (!row) return fail('User not found', 404);
  if (row.twoFactorEnabled) return fail('Two-factor is already enabled', 409, 'ALREADY_ENABLED');

  const secret = generateSecret();
  await db.user.update({ where: { id: user.id }, data: { twoFactorSecret: sealSecret(secret) } });

  const uri = otpAuthUrl(secret, row.email);
  return json({ secret, otpauthUrl: uri, qr: await qrDataUrl(uri) });
});
