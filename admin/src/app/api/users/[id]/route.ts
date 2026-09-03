import { db } from '@/lib/db';
import { json, withAuth, parseBody, fail } from '@/lib/api';
import { userUpdate } from '@/lib/schemas';
import { hashPassword, generateBackupCodes } from '@/lib/password';
import { revokeAllSessions } from '@/lib/session';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';
import { sendMail } from '@/lib/mailer';

type P = { id: string };

export const PATCH = withAuth<P>(
  { permission: 'users:write', limit: LIMITS.write },
  async ({ req, params, user, ip, userAgent }) => {
    const before = await db.user.findUnique({ where: { id: params.id } });
    if (!before) return fail('User not found', 404);

    const data = await parseBody(req, userUpdate);

    // Guard rails against locking the product out of its own admin panel.
    if (params.id === user.id && data.role && data.role !== before.role) {
      return fail('You cannot change your own role', 400, 'SELF_ROLE_CHANGE');
    }
    if (params.id === user.id && data.isActive === false) {
      return fail('You cannot deactivate your own account', 400, 'SELF_DEACTIVATE');
    }
    if (before.role === 'SUPER_ADMIN' && (data.role !== undefined && data.role !== 'SUPER_ADMIN')) {
      const supers = await db.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
      if (supers <= 1) return fail('At least one active Super Admin must remain', 400, 'LAST_SUPER_ADMIN');
    }

    const after = await db.user.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, username: true, name: true, role: true, isActive: true },
    });

    // A disabled account should not keep working until its token expires.
    if (data.isActive === false) await revokeAllSessions(params.id);

    await writeAudit({
      actor: user, action: 'UPDATE', entity: 'User', entityId: after.id,
      summary: after.name,
      before: { name: before.name, role: before.role, isActive: before.isActive },
      after, ip, userAgent,
    });
    return json({ user: after });
  },
);

export const DELETE = withAuth<P>(
  { permission: 'users:write', limit: LIMITS.write },
  async ({ params, user, ip, userAgent }) => {
    if (params.id === user.id) return fail('You cannot delete your own account', 400, 'SELF_DELETE');

    const before = await db.user.findUnique({ where: { id: params.id } });
    if (!before) return fail('User not found', 404);

    if (before.role === 'SUPER_ADMIN') {
      const supers = await db.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
      if (supers <= 1) return fail('At least one active Super Admin must remain', 400, 'LAST_SUPER_ADMIN');
    }

    await db.user.delete({ where: { id: params.id } });
    await writeAudit({
      actor: user, action: 'DELETE', entity: 'User', entityId: params.id,
      summary: `${before.name} (${before.email})`,
      before: { name: before.name, email: before.email, role: before.role },
      ip, userAgent,
    });
    return json({ ok: true });
  },
);

/** Super Admin resets someone's password; they must change it on next sign-in. */
export const POST = withAuth<P>(
  { permission: 'users:write', limit: LIMITS.write },
  async ({ params, user, ip, userAgent }) => {
    const target = await db.user.findUnique({ where: { id: params.id } });
    if (!target) return fail('User not found', 404);

    const tempPassword = generateBackupCodes(1)[0]! + 'aA1!';
    await db.user.update({
      where: { id: params.id },
      data: {
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    await revokeAllSessions(params.id);

    await sendMail({
      to: target.email,
      subject: 'Your Baytna Burger admin password was reset',
      text: `Hi ${target.name},\n\nAn administrator reset your password.\n\nTemporary password: ${tempPassword}\n\nYou will be asked to choose a new one when you sign in.`,
    });

    await writeAudit({
      actor: user, action: 'PASSWORD_RESET_BY_ADMIN', entity: 'User', entityId: params.id,
      summary: `Reset password for ${target.name}; sessions revoked`, ip, userAgent,
    });
    return json({ ok: true, temporaryPassword: tempPassword });
  },
);
