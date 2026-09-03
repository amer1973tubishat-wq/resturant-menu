import { db } from '@/lib/db';
import { json, withAuth, parseBody, fail } from '@/lib/api';
import { userCreate } from '@/lib/schemas';
import { hashPassword, generateBackupCodes } from '@/lib/password';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';
import { sendMail } from '@/lib/mailer';
import { env } from '@/lib/env';

export const GET = withAuth({ permission: 'users:read' }, async () => {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, username: true, name: true, role: true, isActive: true,
      mustChangePassword: true, twoFactorEnabled: true,
      lastLoginAt: true, lastLoginIp: true, createdAt: true, lockedUntil: true,
      // passwordHash and twoFactorSecret are never selected
    },
  });
  return json({ users });
});

export const POST = withAuth(
  { permission: 'users:write', limit: LIMITS.write },
  async ({ req, user, ip, userAgent }) => {
    const data = await parseBody(req, userCreate);

    const clash = await db.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] },
      select: { email: true, username: true },
    });
    if (clash) {
      return fail(
        clash.email === data.email ? 'That email is already registered' : 'That username is taken',
        409, 'DUPLICATE',
      );
    }

    // A one-time password the admin passes on; the account cannot be used for
    // anything until it is replaced (mustChangePassword defaults to true).
    const tempPassword = generateBackupCodes(1)[0]! + 'aA1!';
    const created = await db.user.create({
      data: {
        ...data,
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
        createdById: user.id,
      },
      select: { id: true, email: true, username: true, name: true, role: true, isActive: true },
    });

    await sendMail({
      to: created.email,
      subject: 'Your Baytna Burger admin account',
      text: `Hi ${created.name},\n\nAn admin account has been created for you.\n\nSign in at ${env.APP_URL}\nUsername: ${created.username}\nTemporary password: ${tempPassword}\n\nYou will be asked to choose a new password the first time you sign in.`,
    });

    await writeAudit({
      actor: user, action: 'CREATE', entity: 'User', entityId: created.id,
      summary: `${created.name} (${created.role})`, after: created, ip, userAgent,
    });

    // Returned once so a Super Admin without mail configured can still hand it over.
    return json({ user: created, temporaryPassword: tempPassword }, 201);
  },
);
