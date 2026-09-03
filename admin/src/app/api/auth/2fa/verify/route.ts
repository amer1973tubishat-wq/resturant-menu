import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { withAuth, parseBody, fail } from '@/lib/api';
import { LIMITS } from '@/lib/rate-limit';
import { verifyTotp, openSecret } from '@/lib/totp';
import { verifyPassword } from '@/lib/password';
import { reissueAccess } from '@/lib/session';
import { writeAudit } from '@/lib/audit';

const schema = z.object({
  code: z.string().min(6).max(14), // 6-digit TOTP or a XXXXX-XXXXX backup code
});

/**
 * The only route reachable while twoFactorPending is set. Accepts either a
 * TOTP code or a single-use backup code.
 */
export const POST = withAuth(
  { allowWhileTwoFactorPending: true, allowWhilePasswordChangePending: true, limit: LIMITS.twoFactor },
  async ({ user, ip, userAgent, req }) => {
    if (!user.twoFactorPending) return fail('Two-factor is not pending for this session', 400, 'NOT_PENDING');

    const { code } = await parseBody(req, schema);
    const row = await db.user.findUnique({
      where: { id: user.id },
      include: { backupCodes: { where: { usedAt: null } } },
    });
    if (!row?.twoFactorSecret) return fail('Two-factor is not configured', 400, 'NOT_CONFIGURED');

    let accepted = false;
    let usedBackup = false;

    if (/^\d{6}$/.test(code.trim())) {
      accepted = verifyTotp(openSecret(row.twoFactorSecret), code);
    }

    if (!accepted) {
      for (const bc of row.backupCodes) {
        if (await verifyPassword(bc.codeHash, code.trim().toUpperCase())) {
          await db.backupCode.update({ where: { id: bc.id }, data: { usedAt: new Date() } });
          accepted = true;
          usedBackup = true;
          break;
        }
      }
    }

    if (!accepted) {
      await writeAudit({
        actor: { id: user.id, name: user.name }, action: 'TWO_FACTOR_FAILED', entity: 'User',
        entityId: user.id, ip, userAgent,
      });
      return fail('Incorrect code', 401, 'BAD_CODE');
    }

    const res = NextResponse.json({
      ok: true,
      usedBackupCode: usedBackup,
      remainingBackupCodes: row.backupCodes.length - (usedBackup ? 1 : 0),
      mustChangePassword: row.mustChangePassword,
    });
    // clears twoFactorPending on the access token
    await reissueAccess(res, row, user.sessionId, { twoFactorPending: false });

    await writeAudit({
      actor: { id: user.id, name: user.name }, action: 'TWO_FACTOR_OK', entity: 'User', entityId: user.id,
      summary: usedBackup ? 'Verified with a backup code' : 'Verified with authenticator', ip, userAgent,
    });
    return res;
  },
);
