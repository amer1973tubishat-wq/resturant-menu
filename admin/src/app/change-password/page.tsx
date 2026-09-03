'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/client';
import { Button, Input, Label } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Mirrors the server-side rules in src/lib/password.ts, for live feedback only. */
function score(v: string) {
  let s = 0;
  if (v.length >= 12) s++;
  if (v.length >= 16) s++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
  if (/(.)\1{3,}/.test(v) || /(?:abc|123|qwe|password|admin)/i.test(v)) s = Math.max(0, s - 2);
  return Math.min(4, s);
}

const RULES = [
  { label: 'At least 12 characters', test: (v: string) => v.length >= 12 },
  { label: 'Upper and lowercase letters', test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: 'At least one number', test: (v: string) => /\d/.test(v) },
  { label: 'At least one symbol', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  const { t } = useLang();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNext] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const s = score(newPassword);
  const bars = ['bg-jo-red', 'bg-jo-red', 'bg-gold', 'bg-gold', 'bg-emerald-500'];
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    if (newPassword !== confirmPassword) return setErrors(['Passwords do not match']);
    setBusy(true);
    try {
      await api('/api/auth/password/change', { json: { currentPassword, newPassword, confirmPassword } });
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        const issues = (err.issues ?? []) as (string | { message: string })[];
        setErrors(issues.length ? issues.map((i) => (typeof i === 'string' ? i : i.message)) : [err.message]);
      } else setErrors(['Could not change password']);
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-char-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-2xl border border-char-500 bg-char-800 p-7 shadow-2xl"
      >
        <h1 className="font-display text-xl uppercase text-cream">{t('mustChange')}</h1>
        <p className="mt-1 text-xs text-cream-dim">{t('mustChangeHelp')}</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <Label className="text-cream-dim">{t('currentPassword')}</Label>
            <Input
              type="password" required autoComplete="current-password"
              value={currentPassword} onChange={(e) => setCurrent(e.target.value)}
              className="border-char-500 bg-char-700 text-cream"
            />
          </div>
          <div>
            <Label className="text-cream-dim">{t('newPassword')}</Label>
            <Input
              type="password" required autoComplete="new-password"
              value={newPassword} onChange={(e) => setNext(e.target.value)}
              className="border-char-500 bg-char-700 text-cream"
            />
            {newPassword && (
              <>
                <div className="mt-2 flex gap-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={cn('h-1 flex-1 rounded-full', i < s ? bars[s] : 'bg-char-500')} />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-cream-dim">{labels[s]}</p>
                <ul className="mt-2 space-y-1">
                  {RULES.map((r) => (
                    <li key={r.label} className={cn('text-[11px]', r.test(newPassword) ? 'text-emerald-400' : 'text-char-500')}>
                      {r.test(newPassword) ? '✓' : '○'} {r.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div>
            <Label className="text-cream-dim">{t('confirmPassword')}</Label>
            <Input
              type="password" required autoComplete="new-password"
              value={confirmPassword} onChange={(e) => setConfirm(e.target.value)}
              className="border-char-500 bg-char-700 text-cream"
            />
          </div>

          {errors.length > 0 && (
            <ul role="alert" className="space-y-1 rounded-lg border border-jo-red/40 bg-jo-red/10 px-3 py-2 text-xs text-[#FF6B7E]">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <Button type="submit" loading={busy} className="w-full">{t('save')}</Button>
        </form>
      </motion.div>
    </main>
  );
}
