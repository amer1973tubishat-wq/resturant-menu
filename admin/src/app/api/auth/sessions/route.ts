import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { json, withAuth } from '@/lib/api';
import { revokeAllSessions, clearAuthCookies } from '@/lib/session';
import { writeAudit } from '@/lib/audit';

export const GET = withAuth({}, async ({ user }) => {
  const sessions = await db.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true, ip: true, userAgent: true, lastSeenAt: true, createdAt: true },
  });
  return json({
    sessions: sessions.map((s) => ({ ...s, current: s.id === user.sessionId })),
  });
});

/** "Sign out of every device", including this one. */
export const DELETE = withAuth({}, async ({ user, ip, userAgent }) => {
  await revokeAllSessions(user.id);
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  await writeAudit({
    actor: { id: user.id, name: user.name }, action: 'SESSIONS_REVOKED', entity: 'User',
    entityId: user.id, summary: 'Signed out of all devices', ip, userAgent,
  });
  return res;
});
