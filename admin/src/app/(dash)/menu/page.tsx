'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GripVertical, Plus, Search, Trash2, Copy, Eye, EyeOff, X } from 'lucide-react';
import { api, ApiError } from '@/lib/client';
import { Badge, Button, Card, CardBody, Input, Label, Skeleton, Switch, Textarea } from '@/components/ui';
import { useUi } from '@/components/ui/toast';
import { useLang } from '@/lib/i18n';
import { cn, formatJD } from '@/lib/utils';

type Category = { id: string; slug: string; nameEn: string; nameAr: string; order: number; isVisible: boolean; _count: { items: number } };
type Item = {
  id: string; categoryId: string; nameEn: string; nameAr: string; descEn: string; descAr: string;
  price: string; badges: string[]; spiceLevel: number; isAvailable: boolean; isPublished: boolean; order: number;
  category?: { nameEn: string; nameAr: string };
};

const BADGES = ['BEST_SELLER', 'NEW', 'SPICY', 'VEGETARIAN', 'CHEF_PICK'] as const;
const BADGE_LABEL: Record<string, string> = {
  BEST_SELLER: 'Best seller', NEW: 'New', SPICY: 'Spicy', VEGETARIAN: 'Vegetarian', CHEF_PICK: "Chef's pick",
};

const emptyItem = (categoryId: string): Partial<Item> => ({
  categoryId, nameEn: '', nameAr: '', descEn: '', descAr: '',
  price: '0.00', badges: [], spiceLevel: 0, isAvailable: true, isPublished: true,
});

export default function MenuPage() {
  const { t, lang } = useLang();
  const { toast, confirm } = useUi();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [loading, setLoading] = useState(true);

  const dragId = useRef<string | null>(null);

  const loadCategories = useCallback(async () => {
    const res = await api<{ categories: Category[] }>('/api/menu/categories');
    setCategories(res.categories);
    setActiveCat((cur) => cur ?? res.categories[0]?.id ?? null);
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), perPage: '20' });
    if (activeCat) params.set('categoryId', activeCat);
    if (q.trim()) params.set('q', q.trim());
    try {
      const res = await api<{ items: Item[]; pages: number }>(`/api/menu/items?${params}`);
      setItems(res.items);
      setPages(Math.max(1, res.pages));
    } finally {
      setLoading(false);
    }
  }, [activeCat, q, page]);

  useEffect(() => { loadCategories().catch(() => toast('Could not load categories', 'error')); }, [loadCategories, toast]);

  // Debounced so typing in search does not fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => { loadItems().catch(() => toast('Could not load items', 'error')); }, q ? 280 : 0);
    return () => clearTimeout(id);
  }, [loadItems, q, toast]);

  useEffect(() => { setSelected(new Set()); }, [activeCat, page, q]);

  const allSelected = items.length > 0 && selected.size === items.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  async function onDrop(targetId: string) {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId) return;

    const ordered = [...items];
    const fromIdx = ordered.findIndex((i) => i.id === from);
    const toIdx = ordered.findIndex((i) => i.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved!);
    setItems(ordered); // optimistic

    try {
      await api('/api/menu/reorder', { json: { type: 'item', ids: ordered.map((i) => i.id) } });
      toast('Order saved');
    } catch {
      toast('Could not save the new order', 'error');
      loadItems();
    }
  }

  async function bulk(action: string) {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === 'delete') {
      const ok = await confirm({
        title: `Delete ${ids.length} item(s)?`,
        body: 'This cannot be undone. The change is recorded in the audit log.',
        confirmLabel: 'Delete', danger: true,
      });
      if (!ok) return;
    }
    try {
      const res = await api<{ affected: number }>('/api/menu/bulk', { json: { ids, action } });
      toast(`${action} applied to ${res.affected} item(s)`);
      setSelected(new Set());
      loadItems();
      loadCategories();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Bulk action failed', 'error');
    }
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const isNew = !editing.id;
    try {
      if (isNew) await api('/api/menu/items', { json: editing });
      else await api(`/api/menu/items/${editing.id}`, { method: 'PATCH', json: editing });
      toast(isNew ? 'Item created' : 'Item saved');
      setEditing(null);
      loadItems();
      loadCategories();
    } catch (err) {
      const msg = err instanceof ApiError
        ? (Array.isArray(err.issues) && err.issues.length
            ? err.issues.map((i) => (typeof i === 'string' ? i : `${i.path}: ${i.message}`)).join(', ')
            : err.message)
        : 'Could not save';
      toast(msg, 'error');
    }
  }

  async function deleteItem(item: Item) {
    const ok = await confirm({
      title: `Delete "${item.nameEn}"?`,
      body: 'This cannot be undone.', confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/menu/items/${item.id}`, { method: 'DELETE' });
      toast('Item deleted');
      loadItems();
      loadCategories();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete', 'error');
    }
  }

  const catName = useMemo(
    () => (c: Category) => (lang === 'ar' ? c.nameAr : c.nameEn),
    [lang],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-ink">{t('menu')}</h1>
          <p className="text-sm text-muted">{items.length} shown · drag to reorder</p>
        </div>
        <Button onClick={() => setEditing(emptyItem(activeCat ?? categories[0]?.id ?? ''))} disabled={!categories.length}>
          <Plus size={16} /> {t('add')}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* --------------------------------------------------- categories */}
        <Card className="h-fit">
          <CardBody className="space-y-1 p-2">
            <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{t('categories')}</p>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveCat(c.id); setPage(1); }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  activeCat === c.id ? 'bg-flame/12 font-medium text-flame' : 'text-muted hover:bg-surface2 hover:text-ink',
                )}
              >
                <span className="truncate">{catName(c)}</span>
                <span className="shrink-0 text-[11px] tabular-nums opacity-70">{c._count.items}</span>
              </button>
            ))}
            {categories.length === 0 && <p className="px-3 py-2 text-xs text-muted">{t('noResults')}</p>}
          </CardBody>
        </Card>

        {/* -------------------------------------------------------- items */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder={t('search')} className="ps-9"
              />
            </div>
            {selected.size > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-1.5">
                <Button size="sm" variant="subtle" onClick={() => bulk('publish')}><Eye size={14} /> Publish</Button>
                <Button size="sm" variant="subtle" onClick={() => bulk('unpublish')}><EyeOff size={14} /> Hide</Button>
                <Button size="sm" variant="subtle" onClick={() => bulk('duplicate')}><Copy size={14} /> Copy</Button>
                <Button size="sm" variant="danger" onClick={() => bulk('delete')}><Trash2 size={14} /> {selected.size}</Button>
              </motion.div>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : items.length === 0 ? (
            <Card><CardBody className="py-12 text-center text-sm text-muted">{t('noResults')}</CardBody></Card>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-muted">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-3.5 w-3.5 accent-[#FF6A1A]" />
                Select all on this page
              </label>

              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={() => { dragId.current = item.id; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(item.id)}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-shadow',
                      'hover:shadow-sm', selected.has(item.id) && 'ring-1 ring-flame',
                      !item.isPublished && 'opacity-60',
                    )}
                  >
                    <GripVertical size={15} className="shrink-0 cursor-grab text-muted opacity-0 group-hover:opacity-100" />
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        e.target.checked ? next.add(item.id) : next.delete(item.id);
                        setSelected(next);
                      }}
                      className="h-3.5 w-3.5 shrink-0 accent-[#FF6A1A]"
                      aria-label={`Select ${item.nameEn}`}
                    />

                    <button onClick={() => setEditing(item)} className="min-w-0 flex-1 text-start">
                      <p className="truncate text-sm font-medium text-ink">
                        {lang === 'ar' ? item.nameAr : item.nameEn}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {lang === 'ar' ? item.descAr : item.descEn}
                      </p>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      {item.badges.slice(0, 2).map((b) => (
                        <Badge key={b} tone={b === 'SPICY' ? 'red' : b === 'BEST_SELLER' ? 'gold' : 'neutral'} className="max-sm:hidden">
                          {BADGE_LABEL[b] ?? b}
                        </Badge>
                      ))}
                      {!item.isAvailable && <Badge tone="neutral">Sold out</Badge>}
                      <span className="font-display text-sm text-gold-deep tabular-nums">{formatJD(item.price)}</span>
                      <button
                        onClick={() => deleteItem(item)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-jo-red/10 hover:text-jo-red"
                        aria-label={`Delete ${item.nameEn}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {pages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span className="text-xs text-muted">{page} / {pages}</span>
                  <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------- editor */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50"
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <motion.form
            initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={saveItem}
            className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-surface p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg uppercase text-ink">
                {editing.id ? t('edit') : t('create')}
              </h2>
              <button type="button" onClick={() => setEditing(null)} aria-label={t('cancel')}>
                <X size={18} className="text-muted hover:text-ink" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Name (EN)</Label>
                  <Input required value={editing.nameEn ?? ''} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} />
                </div>
                <div>
                  <Label>الاسم (AR)</Label>
                  <Input required dir="rtl" value={editing.nameAr ?? ''} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Description (EN)</Label>
                  <Textarea rows={3} value={editing.descEn ?? ''} onChange={(e) => setEditing({ ...editing, descEn: e.target.value })} />
                </div>
                <div>
                  <Label>الوصف (AR)</Label>
                  <Textarea rows={3} dir="rtl" value={editing.descAr ?? ''} onChange={(e) => setEditing({ ...editing, descAr: e.target.value })} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t('price')} (JD)</Label>
                  <Input
                    type="number" step="0.25" min="0" required
                    value={editing.price ?? '0.00'}
                    onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t('category')}</Label>
                  <select
                    value={editing.categoryId ?? ''}
                    onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                    className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink"
                  >
                    {categories.map((c) => <option key={c.id} value={c.id}>{catName(c)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <Label>{t('spice')}: {editing.spiceLevel ?? 0}</Label>
                <input
                  type="range" min={0} max={5} step={1}
                  value={editing.spiceLevel ?? 0}
                  onChange={(e) => setEditing({ ...editing, spiceLevel: Number(e.target.value) })}
                  className="w-full accent-[#FF6A1A]"
                />
              </div>

              <div>
                <Label>{t('badges')}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {BADGES.map((b) => {
                    const on = (editing.badges ?? []).includes(b);
                    return (
                      <button
                        key={b} type="button"
                        onClick={() => {
                          const cur = new Set(editing.badges ?? []);
                          on ? cur.delete(b) : cur.add(b);
                          setEditing({ ...editing, badges: [...cur] });
                        }}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          on ? 'border-flame bg-flame/15 text-flame' : 'border-line text-muted hover:text-ink',
                        )}
                      >
                        {BADGE_LABEL[b]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <Switch
                    checked={editing.isAvailable ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, isAvailable: v })}
                    label={t('available')}
                  />
                  {t('available')}
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <Switch
                    checked={editing.isPublished ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, isPublished: v })}
                    label={t('published')}
                  />
                  {t('published')}
                </label>
              </div>
            </div>

            <div className="mt-auto flex gap-2 pt-6">
              <Button type="submit" className="flex-1">{t('save')}</Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>{t('cancel')}</Button>
            </div>
          </motion.form>
        </div>
      )}
    </div>
  );
}
