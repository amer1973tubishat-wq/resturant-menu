import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { verifyPassword, hashPassword } from '@/lib/password';
import { createSession } from '@/lib/session';
import { withPublic, parseBody, fail, getUa } from '@/lib/api';
import { LIMITS, lockoutDuration, recordLoginAttempt } from '@/lib/rate-limit';
import { writeAudit } from '@/lib/audit';
import { deviceFingerprint } from '@/lib/crypto';
import { sendMail, templates } from '@/lib/mailer';

const schema = z.object({
  identifier: z.string().min(1).max(200), // email or username
  password: z.string().min(1).max(200),
  rememberMe: z.boolean().optional(),
});

/**
 * A hash to verify against when the account does not exist, so a missing user
 * costs the same ~40ms as a wrong password. Without it, response timing tells
 * an attacker which emails are registered.
 */
let decoyHash: string | null = null;
async function getDecoy() {
  if (!decoyHash) decoyHash = await hashPassword('decoy-password-not-in-use');
  return decoyHash;
}

export const POST = withPublic({ limit: LIMITS.login }, async (req, ip) => {
  const { identifier, password, rememberMe } = await parseBody(req, schema);
  const userAgent = getUa(req);
  const id = identifier.trim().toLowerCase();

  const user = await db.user.findFirst({
    where: { OR: [{ email: id }, { username: id }] },
  });

  // Same message for every failure path — never reveal which part was wrong.
  const GENERIC = 'Incorrect credentials';

  if (!user) {
    await verifyPassword(await getDecoy(), password);
    await recordLoginAttempt(id, ip, false);
    return fail(GENERIC, 401, 'INVALID_CREDENTIALS');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    await recordLoginAttempt(id, ip, false);
    return fail(`Account locked. Try again in ${mins} minute(s).`, 423, 'ACCOUNT_LOCKED');
  }

  if (!user.isActive) {
    await recordLoginAttempt(id, ip, false);
    return fail('This account has been disabled', 403, 'ACCOUNT_DISABLED');
  }

  const ok = await verifyPassword(user.passwordHash, password);

  if (!ok) {
    const failed = user.failedAttempts + 1;
    const lockMinutes = lockoutDuration(failed, env.MAX_LOGIN_ATTEMPTS);
    await db.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: failed,
        lockedUntil: lockMinutes > 0 ? new Date(Date.now() + lockMinutes * 60_000) : null,
      },
    });
    await recordLoginAttempt(id, ip, false);
    if (lockMinutes > 0) {
      const t = templates.accountLocked(user.name, lockMinutes);
      await sendMail({ to: user.email, ...t });
      await writeAudit({
        actor: null, action: 'ACCOUNT_LOCKED', entity: 'User', entityId: user.id,
        summary: `Locked for ${lockMinutes}m after ${failed} failed attempts`, ip, userAgent,
      });
      return fail(`Too many failed attempts. Account locked for ${lockMinutes} minutes.`, 423, 'ACCOUNT_LOCKED');
    }
    return fail(GENERIC, 401, 'INVALID_CREDENTIALS');
  }

  // success — clear the counters
  await db.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: ip },
  });
  await recordLoginAttempt(id, ip, true);

  // A session is created even when 2FA is pending, but the token carries
  // twoFactorPending so the guard refuses every route except the 2FA check.
  const res = NextResponse.json({
    ok: true,
    twoFactorRequired: user.twoFactorEnabled,
    mustChangePassword: user.mustChangePassword,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });

  await createSession(res, user, { ip, userAgent }, {
    twoFactorPending: user.twoFactorEnabled,
    rememberMe: rememberMe ?? false,
  });

  // Tell the owner about a device we have not seen before.
  const fp = deviceFingerprint(userAgent, ip);
  const known = await db.knownDevice.findUnique({
    where: { userId_fingerprintHash: { userId: user.id, fingerprintHash: fp } },
  });
  if (!known) {
    await db.knownDevice.create({ data: { userId: user.id, fingerprintHash: fp, label: userAgent.slice(0, 120) } });
    const t = templates.newDevice(user.name, ip, userAgent, new Date());
    await sendMail({ to: user.email, ...t });
  } else {
    await db.knownDevice.update({ where: { id: known.id }, data: { lastSeenAt: new Date() } });
  }

  await writeAudit({
    actor: { id: user.id, name: user.name }, action: 'LOGIN', entity: 'User', entityId: user.id,
    summary: user.twoFactorEnabled ? 'Password accepted, awaiting 2FA' : 'Signed in', ip, userAgent,
  });

  return res;
});
