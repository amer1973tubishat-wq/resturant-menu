'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' };
type ConfirmState = {
  title: string; body?: string; confirmLabel?: string; danger?: boolean;
  resolve: (ok: boolean) => void;
} | null;

const Ctx = React.createContext<{
  toast: (message: string, tone?: Toast['tone']) => void;
  confirm: (opts: { title: string; body?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
} | null>(null);

export function useUi() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useUi must be used inside <UiProvider>');
  return ctx;
}

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [dialog, setDialog] = React.useState<ConfirmState>(null);
  const nextId = React.useRef(1);

  const toast = React.useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const confirm = React.useCallback(
    (opts: { title: string; body?: string; confirmLabel?: string; danger?: boolean }) =>
      new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })),
    [],
  );

  const close = (ok: boolean) => {
    dialog?.resolve(ok);
    setDialog(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {/* Toasts — announced politely so they do not interrupt a screen reader */}
      <div className="pointer-events-none fixed bottom-4 end-4 z-[100] flex w-80 flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto animate-fade-up rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur',
              t.tone === 'success' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              t.tone === 'error' && 'border-jo-red/40 bg-jo-red/10 text-jo-red',
              t.tone === 'info' && 'border-line bg-surface text-ink',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Confirmation — every destructive action goes through this */}
      {dialog && (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && close(false)}
        >
          <div className="w-full max-w-sm animate-fade-up rounded-xl border border-line bg-surface p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-ink">{dialog.title}</h2>
            {dialog.body && <p className="mt-2 text-sm text-muted">{dialog.body}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => close(false)}
                className="h-9 rounded-lg border border-line px-4 text-sm text-ink hover:bg-surface2"
              >
                Cancel
              </button>
              <button
                autoFocus
                onClick={() => close(true)}
                className={cn(
                  'h-9 rounded-lg px-4 text-sm font-medium text-white',
                  dialog.danger ? 'bg-jo-red hover:bg-jo-hi' : 'bg-flame text-[#160A02] hover:bg-flame-deep',
                )}
              >
                {dialog.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
