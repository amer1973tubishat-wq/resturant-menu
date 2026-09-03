import { z } from 'zod';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { json, withPublic, parseBody } from '@/lib/api';
import { randomToken, sha256 } from '@/lib/crypto';
import { LIMITS } from '@/lib/rate-limit';
import { sendMail, templates } from '@/lib/mailer';

const schema = z.object({ email: z.string().email() });

export const POST = withPublic({ limit: LIMITS.passwordReset }, async (req) => {
  const { email } = await parseBody(req, schema);
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

  // Always the same response, whether or not the address exists — otherwise
  // this endpoint becomes an account-enumeration oracle.
  const SAME = json({ ok: true, message: 'If that address has an account, a reset link is on its way.' });
  if (!user || !user.isActive) return SAME;

  // Only the newest link should work.
  await db.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const raw = randomToken(32);
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + 15 * 60_000), // 15 minutes
    },
  });

  const link = `${env.APP_URL}/reset-password?token=${raw}`;
  await sendMail({ to: user.email, ...templates.passwordReset(user.name, link) });
  return SAME;
});
