'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/client';
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Skeleton, Switch, Textarea } from '@/components/ui';
import { useUi } from '@/components/ui/toast';
import { useLang } from '@/lib/i18n';

type Slide = {
  id: string; mediaId: string | null; titleEn: string; titleAr: string;
  subtitleEn: string; subtitleAr: string; ctaTextEn: string; ctaTextAr: string;
  ctaHref: string; overlayOpacity: number; isActive: boolean;
  media: { url: string; mediumUrl: string | null } | null;
};

export default function HeroPage() {
  const { t } = useLang();
  const { toast, confirm } = useUi();
  const [slides, setSlides] = useState<Slide[] | null>(null);

  const load = useCallback(async () => {
    const res = await api<{ slides: Slide[] }>('/api/hero');
    setSlides(res.slides);
  }, []);

  useEffect(() => { load().catch(() => setSlides([])); }, [load]);

  async function patch(slide: Slide, changes: Partial<Slide>) {
    setSlides((cur) => cur?.map((s) => (s.id === slide.id ? { ...s, ...changes } : s)) ?? cur);
    try {
      await api(`/api/hero/${slide.id}`, { method: 'PATCH', json: changes });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', 'error');
      load();
    }
  }

  async function add() {
    try {
      await api('/api/hero', { json: { titleEn: 'New slide', titleAr: 'شريحة جديدة', overlayOpacity: 0.5 } });
      toast('Slide added');
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not add', 'error');
    }
  }

  async function remove(slide: Slide) {
    const ok = await confirm({ title: 'Delete this slide?', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await api(`/api/hero/${slide.id}`, { method: 'DELETE' }).catch(() => toast('Could not delete', 'error'));
    load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-ink">{t('hero')}</h1>
          <p className="text-sm text-muted">Slides shown at the top of the public site</p>
        </div>
        <Button onClick={add}><Plus size={16} /> {t('add')}</Button>
      </div>

      {!slides ? (
        <Skeleton className="h-64 w-full" />
      ) : slides.length === 0 ? (
        <Card><CardBody className="py-12 text-center text-sm text-muted">{t('noResults')}</CardBody></Card>
      ) : (
        slides.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle>{s.titleEn || 'Untitled slide'}</CardTitle>
              <div className="flex items-center gap-2">
                <Switch checked={s.isActive} onCheckedChange={(v) => patch(s, { isActive: v })} label="Active" />
                <button onClick={() => remove(s)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-jo-red" aria-label="Delete slide">
                  <Trash2 size={14} />
                </button>
              </div>
            </CardHeader>
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <div><Label>Headline (EN)</Label><Input value={s.titleEn} onChange={(e) => patch(s, { titleEn: e.target.value })} /></div>
              <div><Label>العنوان (AR)</Label><Input dir="rtl" value={s.titleAr} onChange={(e) => patch(s, { titleAr: e.target.value })} /></div>
              <div><Label>Subtitle (EN)</Label><Textarea rows={2} value={s.subtitleEn} onChange={(e) => patch(s, { subtitleEn: e.target.value })} /></div>
              <div><Label>العنوان الفرعي (AR)</Label><Textarea rows={2} dir="rtl" value={s.subtitleAr} onChange={(e) => patch(s, { subtitleAr: e.target.value })} /></div>
              <div><Label>Button text (EN)</Label><Input value={s.ctaTextEn} onChange={(e) => patch(s, { ctaTextEn: e.target.value })} /></div>
              <div><Label>نص الزر (AR)</Label><Input dir="rtl" value={s.ctaTextAr} onChange={(e) => patch(s, { ctaTextAr: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Button link</Label><Input dir="ltr" value={s.ctaHref} onChange={(e) => patch(s, { ctaHref: e.target.value })} /></div>
              <div className="sm:col-span-2">
                <Label>Overlay darkness: {Math.round(s.overlayOpacity * 100)}%</Label>
                <input
                  type="range" min={0} max={1} step={0.05} value={s.overlayOpacity}
                  onChange={(e) => patch(s, { overlayOpacity: Number(e.target.value) })}
                  className="w-full accent-[#FF6A1A]"
                />
                {/* live preview of the overlay over the brand ground */}
                <div className="mt-2 h-16 rounded-lg border border-line bg-gradient-to-r from-flame to-gold">
                  <div className="grid h-full place-items-center rounded-lg text-xs font-semibold text-white"
                       style={{ background: `rgba(10,10,11,${s.overlayOpacity})` }}>
                    {s.titleEn || 'Preview'}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}
