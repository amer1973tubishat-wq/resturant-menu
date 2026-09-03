import { z } from 'zod';
import { db } from '@/lib/db';
import { json, withAuth, parseBody, fail } from '@/lib/api';
import { verifyTotp, openSecret } from '@/lib/totp';
import { generateBackupCodes, hashPassword } from '@/lib/password';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

const schema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });

export const POST = withAuth({ limit: LIMITS.twoFactor }, async ({ user, req, ip, userAgent }) => {
  const { code } = await parseBody(req, schema);
  const row = await db.user.findUnique({ where: { id: user.id } });
  if (!row?.twoFactorSecret) return fail('Start setup first', 400, 'NO_SECRET');
  if (!verifyTotp(openSecret(row.twoFactorSecret), code)) return fail('Incorrect code', 401, 'BAD_CODE');

  // Backup codes are shown exactly once, here, and stored only as hashes.
  // Hashing happens before the transaction opens — ten Argon2id runs would
  // otherwise hold the transaction open for most of a second.
  const codes = generateBackupCodes(10);
  const codeRows = await Promise.all(
    codes.map(async (c) => ({ userId: user.id, codeHash: await hashPassword(c) })),
  );

  await db.$transaction([
    db.backupCode.deleteMany({ where: { userId: user.id } }),
    db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true, twoFactorVerifiedAt: new Date() },
    }),
    db.backupCode.createMany({ data: codeRows }),
  ]);

  await writeAudit({
    actor: { id: user.id, name: user.name }, action: 'TWO_FACTOR_ENABLED', entity: 'User',
    entityId: user.id, ip, userAgent,
  });
  return json({ ok: true, backupCodes: codes });
});
