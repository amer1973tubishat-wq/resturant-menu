'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/client';
import { Button, Input, Label } from '@/components/ui';
import { useLang } from '@/lib/i18n';

export default function TwoFactorPage() {
  const router = useRouter();
  const { t } = useLang();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ mustChangePassword: boolean; usedBackupCode: boolean; remainingBackupCodes: number }>(
        '/api/auth/2fa/verify',
        { json: { code } },
      );
      if (res.usedBackupCode) {
        alert(`Backup code used. ${res.remainingBackupCodes} remaining.`);
      }
      router.push(res.mustChangePassword ? '/change-password' : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed');
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-char-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-2xl border border-char-500 bg-char-800 p-7 shadow-2xl"
      >
        <h1 className="font-display text-xl uppercase text-cream">{t('twoFactor')}</h1>
        <p className="mt-1 text-xs text-cream-dim">{t('enterCode')}</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="code" className="text-cream-dim">Code</Label>
            <Input
              id="code" name="code" inputMode="text" autoFocus required
              autoComplete="one-time-code" maxLength={14}
              value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="border-char-500 bg-char-700 text-center font-mono text-lg tracking-[0.3em] text-cream"
            />
            <p className="mt-2 text-[11px] text-char-500">{t('backupCode')}</p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-jo-red/40 bg-jo-red/10 px-3 py-2 text-xs text-[#FF6B7E]">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy} className="w-full">{t('verify')}</Button>
        </form>
      </motion.div>
    </main>
  );
}
