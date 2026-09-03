import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { ROLE_PERMISSIONS } from '@/lib/rbac';
import { UiProvider } from '@/components/ui/toast';
import { Shell } from '@/components/shell';

/**
 * Server-side gate for every dashboard page. The middleware only checks that a
 * cookie exists; this is where the token is actually verified, so a forged or
 * revoked session never renders a page.
 */
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login');
  if (user.twoFactorPending) redirect('/two-factor');
  if (user.mustChangePassword) redirect('/change-password');

  return (
    <UiProvider>
      <Shell
        user={{ id: user.id, name: user.name, email: user.email, role: user.role }}
        permissions={ROLE_PERMISSIONS[user.role]}
      >
        {children}
      </Shell>
    </UiProvider>
  );
}
