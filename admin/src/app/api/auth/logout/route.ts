import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { revokeSession, clearAuthCookies } from '@/lib/session';
import { writeAudit } from '@/lib/audit';

export const POST = withAuth(
  { allowWhilePasswordChangePending: true, allowWhileTwoFactorPending: true },
  async ({ user, ip, userAgent }) => {
    await revokeSession(user.sessionId);
    const res = NextResponse.json({ ok: true });
    clearAuthCookies(res);
    await writeAudit({
      actor: { id: user.id, name: user.name }, action: 'LOGOUT', entity: 'User',
      entityId: user.id, ip, userAgent,
    });
    return res;
  },
);
