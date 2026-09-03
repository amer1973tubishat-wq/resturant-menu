'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Skeleton, Switch, Textarea } from '@/components/ui';
import { useUi } from '@/components/ui/toast';
import { useLang } from '@/lib/i18n';
import { minutesToTime, timeToMinutes } from '@/lib/utils';

type Hours = { id: string; dayOfWeek: number; openMinutes: number; closeMinutes: number; isClosed: boolean };
type Story = { titleEn: string; titleAr: string; bodyEn: string; bodyAr: string } | null;

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function ContentPage() {
  const { t, lang } = useLang();
  const { toast } = useUi();
  const [hours, setHours] = useState<Hours[] | null>(null);
  const [story, setStory] = useState<Story>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [h, s] = await Promise.all([
      api<{ hours: Hours[] }>('/api/content/hours'),
      api<{ story: Story }>('/api/content/story'),
    ]);
    setHours(h.hours);
    setStory(s.story ?? { titleEn: '', titleAr: '', bodyEn: '', bodyAr: '' });
  }, []);

  useEffect(() => { load().catch(() => toast('Could not load content', 'error')); }, [load, toast]);

  async function saveHours() {
    if (!hours) return;
    setSaving(true);
    try {
      await api('/api/content/hours', {
        method: 'PUT',
        json: { days: hours.map((h) => ({ dayOfWeek: h.dayOfWeek, openMinutes: h.openMinutes, closeMinutes: h.closeMinutes, isClosed: h.isClosed })) },
      });
      toast('Opening hours saved');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', 'error');
    } finally { setSaving(false); }
  }

  async function saveStory() {
    if (!story) return;
    setSaving(true);
    try {
      await api('/api/content/story', { method: 'PUT', json: story });
      toast('Story saved');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', 'error');
    } finally { setSaving(false); }
  }

  const days = lang === 'ar' ? DAYS_AR : DAYS_EN;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-2xl uppercase tracking-wide text-ink">{t('content')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Opening hours (Amman time)</CardTitle>
          <Button size="sm" loading={saving} onClick={saveHours}>{t('save')}</Button>
        </CardHeader>
        <CardBody className="space-y-2">
          {!hours ? <Skeleton className="h-56 w-full" /> : hours.map((h, i) => (
            <div key={h.id} className="flex flex-wrap items-center gap-3 border-b border-line pb-2 last:border-0">
              <span className="w-24 text-sm text-ink">{days[h.dayOfWeek]}</span>
              <Switch
                checked={!h.isClosed}
                onCheckedChange={(v) => setHours(hours.map((x, j) => (i === j ? { ...x, isClosed: !v } : x)))}
                label={`Open on ${days[h.dayOfWeek]}`}
              />
              {h.isClosed ? (
                <span className="text-xs text-muted">Closed</span>
              ) : (
                <>
                  <input
                    type="time" value={minutesToTime(h.openMinutes)}
                    onChange={(e) => setHours(hours.map((x, j) => (i === j ? { ...x, openMinutes: timeToMinutes(e.target.value) } : x)))}
                    className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink"
                  />
                  <span className="text-muted">→</span>
                  <input
                    type="time" value={minutesToTime(h.closeMinutes)}
                    onChange={(e) => {
                      let m = timeToMinutes(e.target.value);
                      // A closing time at or before opening means "after midnight".
                      if (m <= h.openMinutes) m += 1440;
                      setHours(hours.map((x, j) => (i === j ? { ...x, closeMinutes: m } : x)));
                    }}
                    className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink"
                  />
                  {h.closeMinutes > 1440 && <span className="text-[11px] text-gold-deep">next day</span>}
                </>
              )}
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Our story</CardTitle>
          <Button size="sm" loading={saving} onClick={saveStory}>{t('save')}</Button>
        </CardHeader>
        <CardBody className="grid gap-3 sm:grid-cols-2">
          {!story ? <Skeleton className="h-40 w-full sm:col-span-2" /> : (
            <>
              <div><Label>Title (EN)</Label><Input value={story.titleEn} onChange={(e) => setStory({ ...story, titleEn: e.target.value })} /></div>
              <div><Label>العنوان (AR)</Label><Input dir="rtl" value={story.titleAr} onChange={(e) => setStory({ ...story, titleAr: e.target.value })} /></div>
              <div className="sm:col-span-2">
                <Label>Body (EN) — basic HTML allowed</Label>
                <Textarea rows={5} value={story.bodyEn} onChange={(e) => setStory({ ...story, bodyEn: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>النص (AR)</Label>
                <Textarea rows={5} dir="rtl" value={story.bodyAr} onChange={(e) => setStory({ ...story, bodyAr: e.target.value })} />
              </div>
              <p className="text-[11px] text-muted sm:col-span-2">
                Markup is sanitised on save — only formatting tags and safe links survive.
              </p>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
