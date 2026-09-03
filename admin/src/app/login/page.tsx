'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { api, ApiError } from '@/lib/client';
import { Button, Input, Label } from '@/components/ui';
import { useLang } from '@/lib/i18n';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, lang, setLang } = useLang();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ twoFactorRequired: boolean; mustChangePassword: boolean }>(
        '/api/auth/login',
        { json: { identifier, password, rememberMe } },
      );
      // Order matters: 2FA gates everything, including the forced change.
      if (res.twoFactorRequired) router.push('/two-factor');
      else if (res.mustChangePassword) router.push('/change-password');
      else router.push(params.get('next') || '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in');
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-char-900 p-4">
      {/* charred ground + flame glow, carried over from the public site */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 70% 20%, rgba(255,106,26,.22), transparent 62%),' +
            'radial-gradient(50% 40% at 20% 80%, rgba(242,179,61,.12), transparent 65%)',
        }}
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm rounded-2xl border border-char-500 bg-char-800/90 p-7 shadow-2xl backdrop-blur"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-flame/15 text-2xl">🍔</div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-cream">Baytna Admin</h1>
          <p className="mt-1 text-xs text-cream-dim">Rainbow Street, Jabal Amman</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="identifier" className="text-cream-dim">{t('username')}</Label>
            <Input
              id="identifier" name="identifier" autoComplete="username" required autoFocus
              value={identifier} onChange={(e) => setIdentifier(e.target.value)}
              className="border-char-500 bg-char-700 text-cream placeholder:text-char-500"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-cream-dim">{t('password')}</Label>
            <Input
              id="password" name="password" type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="border-char-500 bg-char-700 text-cream"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex cursor-pointer items-center gap-2 text-cream-dim">
              <input
                type="checkbox" checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#FF6A1A]"
              />
              {t('rememberMe')}
            </label>
            <a href="/forgot-password" className="text-gold hover:underline">{t('forgotPassword')}</a>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-jo-red/40 bg-jo-red/10 px-3 py-2 text-xs text-[#FF6B7E]">
              {error}
            </p>
          )}

          <Button type="submit" loading={busy} className="w-full">{t('signIn')}</Button>
        </form>

        <button
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className="mx-auto mt-5 block text-xs text-char-500 hover:text-cream-dim"
        >
          {lang === 'en' ? 'العربية' : 'English'}
        </button>
      </motion.div>
    </main>
  );
}

/**
 * useSearchParams opts the subtree into client-side rendering, so Next
 * requires a Suspense boundary around it or the static export of /login fails.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-char-900" />}>
      <LoginForm />
    </Suspense>
  );
}
