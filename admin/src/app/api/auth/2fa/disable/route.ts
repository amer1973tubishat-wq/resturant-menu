import { z } from 'zod';
import { db } from '@/lib/db';
import { json, withAuth, parseBody, fail } from '@/lib/api';
import { verifyPassword } from '@/lib/password';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

// Turning 2FA off is a downgrade, so it costs a password re-entry.
const schema = z.object({ currentPassword: z.string().min(1) });

export const POST = withAuth({ limit: LIMITS.twoFactor }, async ({ user, req, ip, userAgent }) => {
  const { currentPassword } = await parseBody(req, schema);
  const row = await db.user.findUnique({ where: { id: user.id } });
  if (!row) return fail('User not found', 404);
  if (!(await verifyPassword(row.passwordHash, currentPassword))) {
    return fail('Incorrect password', 401, 'BAD_PASSWORD');
  }

  await db.$transaction([
    db.backupCode.deleteMany({ where: { userId: user.id } }),
    db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorVerifiedAt: null },
    }),
  ]);

  await writeAudit({
    actor: { id: user.id, name: user.name }, action: 'TWO_FACTOR_DISABLED', entity: 'User',
    entityId: user.id, ip, userAgent,
  });
  return json({ ok: true });
});
