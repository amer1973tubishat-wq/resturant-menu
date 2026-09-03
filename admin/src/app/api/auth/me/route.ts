import { json, withAuth } from '@/lib/api';
import { ROLE_PERMISSIONS } from '@/lib/rbac';
import { db } from '@/lib/db';

export const GET = withAuth(
  { allowWhilePasswordChangePending: true, allowWhileTwoFactorPending: true },
  async ({ user }) => {
    const row = await db.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true, lastLoginAt: true, lastLoginIp: true, createdAt: true },
    });
    return json({
      user: {
        id: user.id, name: user.name, email: user.email, username: user.username, role: user.role,
        mustChangePassword: user.mustChangePassword,
        twoFactorPending: user.twoFactorPending,
        twoFactorEnabled: row?.twoFactorEnabled ?? false,
        lastLoginAt: row?.lastLoginAt, lastLoginIp: row?.lastLoginIp,
      },
      permissions: ROLE_PERMISSIONS[user.role],
    });
  },
);
