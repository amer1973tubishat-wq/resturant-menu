import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { json, withPublic, parseBody, fail } from '@/lib/api';
import { hashPassword, checkPassword } from '@/lib/password';
import { sha256 } from '@/lib/crypto';
import { LIMITS } from '@/lib/rate-limit';
import { writeAudit } from '@/lib/audit';
import { sendMail, templates } from '@/lib/mailer';

const schema = z
  .object({
    token: z.string().min(20),
    newPassword: z.string().min(1),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match', path: ['confirmPassword'],
  });

export const POST = withPublic({ limit: LIMITS.passwordReset }, async (req, ip) => {
  const { token, newPassword } = await parseBody(req, schema);

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });

  // One message for expired, used, and never-existed.
  const BAD = fail('This reset link is invalid or has expired', 400, 'BAD_TOKEN');
  if (!record || record.usedAt || record.expiresAt < new Date()) return BAD;
  if (!record.user.isActive) return BAD;

  const check = await checkPassword(newPassword);
  if (!check.ok) {
    return NextResponse.json(
      { error: 'Password does not meet the policy', code: 'WEAK_PASSWORD', issues: check.errors },
      { status: 422 },
    );
  }

  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
      },
    }),
    // single use
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // a reset means the old sessions are no longer trustworthy
    db.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  await sendMail({ to: record.user.email, ...templates.passwordChanged(record.user.name, new Date()) });
  await writeAudit({
    actor: { id: record.userId, name: record.user.name }, action: 'PASSWORD_RESET', entity: 'User',
    entityId: record.userId, summary: 'Reset via emailed link; all sessions revoked', ip,
  });
  return json({ ok: true });
});
