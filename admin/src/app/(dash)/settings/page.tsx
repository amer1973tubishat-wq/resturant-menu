'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, DatabaseBackup } from 'lucide-react';
import { api, ApiError } from '@/lib/client';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Skeleton, Switch, Textarea } from '@/components/ui';
import { useUi } from '@/components/ui/toast';
import { useLang } from '@/lib/i18n';

type Settings = Record<string, unknown> & {
  colorPrimary: string; colorAccent: string; colorCta: string; colorBackground: string;
  seoTitleEn: string; seoTitleAr: string; seoDescEn: string; seoDescAr: string; seoKeywords: string;
  addressEn: string; addressAr: string; phone: string; whatsapp: string; email: string;
  defaultLocale: string; showLanguageSwitcher: boolean; maintenanceMode: boolean;
  maintenanceMsgEn: string; maintenanceMsgAr: string;
};

export default function SettingsPage() {
  const { t } = useLang();
  const { toast, confirm } = useUi();
  const [s, setS] = useState<Settings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backups, setBackups] = useState<{ name: string; size: number; createdAt: string }[]>([]);

  const load = useCallback(async () => {
    const res = await api<{ settings: Settings }>('/api/settings');
    setS(res.settings);
    setDirty(false);
  }, []);

  useEffect(() => { load().catch(() => toast('Could not load settings', 'error')); }, [load, toast]);
  useEffect(() => { api<{ backups: typeof backups }>('/api/backup').then((r) => setBackups(r.backups)).catch(() => {}); }, []);

  // Warn before losing edits — the spec asks for this on every editing screen.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((cur) => (cur ? { ...cur, [key]: value } : cur));
    setDirty(true);
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      const { id: _id, logo: _l, favicon: _f, ogImage: _o, updatedAt: _u, ...payload } = s as Record<string, unknown>;
      await api('/api/settings', { method: 'PATCH', json: payload });
      toast('Settings saved');
      setDirty(false);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function runBackup() {
    const ok = await confirm({ title: 'Create a database backup?', confirmLabel: 'Back up' });
    if (!ok) return;
    try {
      await api('/api/backup', { method: 'POST' });
      toast('Backup created');
      const r = await api<{ backups: typeof backups }>('/api/backup');
      setBackups(r.backups);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Backup failed', 'error');
    }
  }

  if (!s) return <div className="mx-auto max-w-3xl space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full" />)}</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-ink">{t('settings')}</h1>
        <p className="text-sm text-muted">These values drive the public site directly</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Brand colours</CardTitle></CardHeader>
        <CardBody className="grid gap-3 sm:grid-cols-4">
          {([
            ['colorPrimary', 'Flame'], ['colorAccent', 'Gold'],
            ['colorCta', 'CTA red'], ['colorBackground', 'Background'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color" value={s[key]} onChange={(e) => set(key, e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded border border-line bg-transparent"
                  aria-label={label}
                />
                <Input value={s[key]} onChange={(e) => set(key, e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <div><Label>Title (EN)</Label><Input value={s.seoTitleEn} onChange={(e) => set('seoTitleEn', e.target.value)} /></div>
          <div><Label>العنوان (AR)</Label><Input dir="rtl" value={s.seoTitleAr} onChange={(e) => set('seoTitleAr', e.target.value)} /></div>
          <div><Label>Description (EN)</Label><Textarea rows={2} value={s.seoDescEn} onChange={(e) => set('seoDescEn', e.target.value)} /></div>
          <div><Label>الوصف (AR)</Label><Textarea rows={2} dir="rtl" value={s.seoDescAr} onChange={(e) => set('seoDescAr', e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Keywords</Label><Input value={s.seoKeywords} onChange={(e) => set('seoKeywords', e.target.value)} /></div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <div><Label>Address (EN)</Label><Input value={s.addressEn} onChange={(e) => set('addressEn', e.target.value)} /></div>
          <div><Label>العنوان (AR)</Label><Input dir="rtl" value={s.addressAr} onChange={(e) => set('addressAr', e.target.value)} /></div>
          <div><Label>Phone</Label><Input dir="ltr" value={s.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><Label>WhatsApp</Label><Input dir="ltr" value={s.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Email</Label><Input type="email" value={s.email} onChange={(e) => set('email', e.target.value)} /></div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Site behaviour</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-ink">Language switcher</p>
              <p className="text-xs text-muted">Show the EN/AR toggle on the public site</p>
            </div>
            <Switch checked={s.showLanguageSwitcher} onCheckedChange={(v) => set('showLanguageSwitcher', v)} label="Language switcher" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-ink">Maintenance mode</p>
              <p className="text-xs text-muted">Visitors see a &ldquo;back soon&rdquo; page instead of the site</p>
            </div>
            <Switch checked={s.maintenanceMode} onCheckedChange={(v) => set('maintenanceMode', v)} label="Maintenance mode" />
          </div>
          <div>
            <Label>Default language</Label>
            <select
              value={s.defaultLocale} onChange={(e) => set('defaultLocale', e.target.value)}
              className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink"
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backups</CardTitle>
          <Button size="sm" variant="outline" onClick={runBackup}><DatabaseBackup size={14} /> Back up now</Button>
        </CardHeader>
        <CardBody className="space-y-1.5">
          {backups.length === 0 ? (
            <p className="text-sm text-muted">No backups yet.</p>
          ) : (
            backups.slice(0, 8).map((b) => (
              <div key={b.name} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs hover:bg-surface2">
                <Download size={13} className="text-muted" />
                <span className="min-w-0 flex-1 truncate font-mono text-ink">{b.name}</span>
                <span className="text-muted">{Math.round(b.size / 1024)} KB</span>
              </div>
            ))
          )}
          <p className="pt-2 text-[11px] text-muted">
            Restore with <code className="rounded bg-surface2 px-1">npm run db:restore &lt;file&gt;</code> — deliberately
            a command, not a button, so a click cannot overwrite live data.
          </p>
        </CardBody>
      </Card>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <p className="flex-1 text-xs text-muted">{t('unsavedChanges')}</p>
            <Button variant="outline" size="sm" onClick={() => load()}>{t('cancel')}</Button>
            <Button size="sm" loading={saving} onClick={save}>{t('save')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
