import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { withAuth, parseBody, fail } from '@/lib/api';
import { verifyPassword, hashPassword, checkPassword } from '@/lib/password';
import { revokeAllSessions, reissueAccess } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { sendMail, templates } from '@/lib/mailer';

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(1),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match', path: ['confirmPassword'],
  });

/**
 * Serves both the forced first-login change and the voluntary one in Profile,
 * so it must remain reachable while mustChangePassword is set.
 */
export const POST = withAuth(
  { allowWhilePasswordChangePending: true },
  async ({ user, req, ip, userAgent }) => {
    const { currentPassword, newPassword } = await parseBody(req, schema);

    const row = await db.user.findUnique({ where: { id: user.id } });
    if (!row) return fail('User not found', 404);

    if (!(await verifyPassword(row.passwordHash, currentPassword))) {
      return fail('Current password is incorrect', 401, 'BAD_PASSWORD');
    }
    if (await verifyPassword(row.passwordHash, newPassword)) {
      return fail('The new password must be different from the current one', 422, 'SAME_PASSWORD');
    }

    const check = await checkPassword(newPassword);
    if (!check.ok) {
      return NextResponse.json(
        { error: 'Password does not meet the policy', code: 'WEAK_PASSWORD', issues: check.errors },
        { status: 422 },
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    // Everything else signs out; a changed password should not leave a stolen
    // session alive. The current device stays in so the user is not bounced.
    await revokeAllSessions(user.id, user.sessionId);

    const res = NextResponse.json({ ok: true });
    await reissueAccess(res, { ...row, mustChangePassword: false }, user.sessionId);

    await sendMail({ to: row.email, ...templates.passwordChanged(row.name, new Date()) });
    await writeAudit({
      actor: { id: user.id, name: user.name }, action: 'PASSWORD_CHANGED', entity: 'User',
      entityId: user.id, summary: 'Other sessions revoked', ip, userAgent,
    });
    return res;
  },
);
