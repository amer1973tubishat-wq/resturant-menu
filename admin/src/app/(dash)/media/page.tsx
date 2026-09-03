'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { api, upload, ApiError } from '@/lib/client';
import { Button, Card, CardBody, Input, Skeleton } from '@/components/ui';
import { useUi } from '@/components/ui/toast';
import { useLang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Media = {
  id: string; filename: string; originalName: string; url: string; thumbUrl: string | null;
  size: number; width: number | null; height: number | null;
  _count: { menuItems: number; heroSlides: number; promotions: number; builderOptions: number; storyBlocks: number };
};

export default function MediaPage() {
  const { t } = useLang();
  const { toast, confirm } = useUi();
  const [media, setMedia] = useState<Media[] | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ perPage: '48' });
    if (q.trim()) params.set('q', q.trim());
    const res = await api<{ media: Media[] }>(`/api/media?${params}`);
    setMedia(res.media);
  }, [q]);

  useEffect(() => {
    const id = setTimeout(() => { load().catch(() => setMedia([])); }, q ? 280 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  async function handleFiles(files: FileList | File[]) {
    const list = [...files];
    if (list.length === 0) return;
    setBusy(true);
    try {
      const res = await upload<{ media: Media[]; errors: { name: string; error: string }[] }>('/api/media', list);
      if (res.media.length) toast(`Uploaded ${res.media.length} file(s)`);
      for (const e of res.errors) toast(`${e.name}: ${e.error}`, 'error');
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: Media) {
    const uses = m._count.menuItems + m._count.heroSlides + m._count.promotions + m._count.builderOptions + m._count.storyBlocks;
    const ok = await confirm({
      title: `Delete ${m.originalName}?`,
      body: uses > 0 ? `This image is used in ${uses} place(s) and cannot be deleted yet.` : 'This cannot be undone.',
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/media/${m.id}`, { method: 'DELETE' });
      toast('Deleted');
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-ink">{t('media')}</h1>
          <p className="text-sm text-muted">Converted to WebP in three sizes on upload</p>
        </div>
        <Button loading={busy} onClick={() => fileInput.current?.click()}><Upload size={16} /> {t('add')}</Button>
        <input
          ref={fileInput} type="file" accept="image/*" multiple hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={cn(
          'rounded-xl border-2 border-dashed p-4 transition-colors',
          dragOver ? 'border-flame bg-flame/5' : 'border-line',
        )}
      >
        {!media ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square w-full" />)}
          </div>
        ) : media.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">Drop images here, or use Add.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {media.map((m) => {
              const uses = m._count.menuItems + m._count.heroSlides + m._count.promotions + m._count.builderOptions + m._count.storyBlocks;
              return (
                <figure key={m.id} className="group relative overflow-hidden rounded-lg border border-line bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.thumbUrl ?? m.url} alt={m.originalName} className="aspect-square w-full object-cover" loading="lazy" />
                  <figcaption className="p-1.5">
                    <p className="truncate text-[10px] text-ink">{m.originalName}</p>
                    <p className="text-[10px] text-muted">
                      {m.width}×{m.height} · {Math.round(m.size / 1024)}KB
                      {uses > 0 && <span className="text-gold-deep"> · used {uses}×</span>}
                    </p>
                  </figcaption>
                  <button
                    onClick={() => remove(m)}
                    className="absolute end-1 top-1 grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Delete ${m.originalName}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </figure>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
