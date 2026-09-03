'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, KeyRound, Trash2, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/client';
import { Badge, Button, Card, CardBody, Input, Label, Skeleton, Switch } from '@/components/ui';
import { useUi } from '@/components/ui/toast';
import { useLang } from '@/lib/i18n';
import { relativeTime } from '@/lib/utils';

type User = {
  id: string; email: string; username: string; name: string; role: string;
  isActive: boolean; mustChangePassword: boolean; twoFactorEnabled: boolean;
  lastLoginAt: string | null; lastLoginIp: string | null; lockedUntil: string | null;
};

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'] as const;
const ROLE_TONE: Record<string, 'red' | 'flame' | 'gold' | 'neutral'> = {
  SUPER_ADMIN: 'red', ADMIN: 'flame', EDITOR: 'gold', VIEWER: 'neutral',
};

export default function UsersPage() {
  const { t, lang } = useLang();
  const { toast, confirm } = useUi();
  const [users, setUsers] = useState<User[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', username: '', role: 'VIEWER' });

  const load = useCallback(async () => {
    const res = await api<{ users: User[] }>('/api/users');
    setUsers(res.users);
  }, []);

  useEffect(() => { load().catch(() => toast('Could not load users', 'error')); }, [load, toast]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await api<{ temporaryPassword: string }>('/api/users', { json: form });
      // Shown once — the admin has to pass it on if mail is not configured.
      await confirm({
        title: 'User created',
        body: `Temporary password: ${res.temporaryPassword}\n\nThey must change it at first sign-in. Copy it now — it will not be shown again.`,
        confirmLabel: 'Copied',
      });
      setCreating(false);
      setForm({ name: '', email: '', username: '', role: 'VIEWER' });
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create user', 'error');
    }
  }

  async function resetPassword(u: User) {
    const ok = await confirm({
      title: `Reset password for ${u.name}?`,
      body: 'Their sessions will be signed out and they must set a new password at next sign-in.',
      confirmLabel: 'Reset',
    });
    if (!ok) return;
    try {
      const res = await api<{ temporaryPassword: string }>(`/api/users/${u.id}`, { method: 'POST' });
      await confirm({ title: 'Password reset', body: `Temporary password: ${res.temporaryPassword}`, confirmLabel: 'Copied' });
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Reset failed', 'error');
    }
  }

  async function toggleActive(u: User) {
    try {
      await api(`/api/users/${u.id}`, { method: 'PATCH', json: { isActive: !u.isActive } });
      toast(u.isActive ? 'Account disabled' : 'Account enabled');
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update', 'error');
    }
  }

  async function changeRole(u: User, role: string) {
    try {
      await api(`/api/users/${u.id}`, { method: 'PATCH', json: { role } });
      toast('Role updated');
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update role', 'error');
    }
  }

  async function remove(u: User) {
    const ok = await confirm({
      title: `Delete ${u.name}?`, body: 'This cannot be undone.', confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/users/${u.id}`, { method: 'DELETE' });
      toast('User deleted');
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-ink">{t('users')}</h1>
          <p className="text-sm text-muted">Super Admin only</p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}><Plus size={16} /> {t('add')}</Button>
      </div>

      {creating && (
        <Card>
          <CardBody>
            <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-2">
              <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Username</Label><Input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
              <div>
                <Label>Role</Label>
                <select
                  value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit">{t('create')}</Button>
                <Button type="button" variant="outline" onClick={() => setCreating(false)}>{t('cancel')}</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {!users ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id}>
              <CardBody className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">{u.name}</p>
                    <Badge tone={ROLE_TONE[u.role]}>{u.role.replace('_', ' ')}</Badge>
                    {u.twoFactorEnabled && <Badge tone="green"><ShieldCheck size={11} /> 2FA</Badge>}
                    {u.mustChangePassword && <Badge tone="gold">Must change password</Badge>}
                    {u.lockedUntil && new Date(u.lockedUntil) > new Date() && <Badge tone="red">Locked</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted">{u.email} · @{u.username}</p>
                  <p className="text-[11px] text-muted">
                    {u.lastLoginAt
                      ? `Last sign-in ${relativeTime(u.lastLoginAt, lang)}${u.lastLoginIp ? ` from ${u.lastLoginIp}` : ''}`
                      : 'Never signed in'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={u.role} onChange={(e) => changeRole(u, e.target.value)}
                    className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                    aria-label={`Role for ${u.name}`}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                  <Switch checked={u.isActive} onCheckedChange={() => toggleActive(u)} label={`Active: ${u.name}`} />
                  <button onClick={() => resetPassword(u)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label="Reset password">
                    <KeyRound size={14} />
                  </button>
                  <button onClick={() => remove(u)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-jo-red/10 hover:text-jo-red" aria-label="Delete user">
                    <Trash2 size={14} />
                  </button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
