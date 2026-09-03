'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/client';
import { Badge, Button, Card, CardBody, Input, Skeleton } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { relativeTime } from '@/lib/utils';

type Log = {
  id: string; actorName: string; action: string; entity: string; entityId: string | null;
  summary: string | null; before: unknown; after: unknown;
  ip: string | null; userAgent: string | null; createdAt: string;
};

const ENTITIES = ['', 'MenuItem', 'Category', 'User', 'Media', 'SiteSettings', 'HeroSlide', 'Message'];

export default function AuditPage() {
  const { t, lang } = useLang();
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), perPage: '30' });
    if (q.trim()) params.set('q', q.trim());
    if (entity) params.set('entity', entity);
    const res = await api<{ logs: Log[]; pages: number }>(`/api/audit?${params}`);
    setLogs(res.logs);
    setPages(Math.max(1, res.pages));
  }, [q, entity, page]);

  useEffect(() => {
    const id = setTimeout(() => { load().catch(() => setLogs([])); }, q ? 280 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-ink">{t('audit')}</h1>
        <p className="text-sm text-muted">Every change, who made it, and the values before and after</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t('search')} className="ps-9" />
        </div>
        <select
          value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}
          className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          aria-label="Filter by entity"
        >
          {ENTITIES.map((e) => <option key={e} value={e}>{e || 'All types'}</option>)}
        </select>
      </div>

      {!logs ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : logs.length === 0 ? (
        <Card><CardBody className="py-12 text-center text-sm text-muted">{t('noResults')}</CardBody></Card>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => (
            <Card key={log.id}>
              <button
                onClick={() => setOpen(open === log.id ? null : log.id)}
                className="flex w-full flex-wrap items-center gap-2 p-3 text-start hover:bg-surface2"
              >
                <Badge tone={log.action.includes('DELETE') ? 'red' : log.action.includes('CREATE') ? 'green' : 'neutral'}>
                  {log.action.replace(/_/g, ' ').toLowerCase()}
                </Badge>
                <span className="text-xs font-medium text-ink">{log.entity}</span>
                {log.summary && <span className="min-w-0 flex-1 truncate text-xs text-muted">{log.summary}</span>}
                <span className="ms-auto text-[11px] text-muted">{log.actorName}</span>
                <span className="text-[11px] text-muted">{relativeTime(log.createdAt, lang)}</span>
              </button>

              {open === log.id && (
                <div className="border-t border-line p-3 text-[11px]">
                  <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-muted">
                    <span>IP: {log.ip ?? '—'}</span>
                    <span>Time: {new Date(log.createdAt).toISOString()}</span>
                    {log.entityId && <span>ID: {log.entityId}</span>}
                  </div>
                  {log.userAgent && <p className="mb-2 break-all text-muted">Device: {log.userAgent}</p>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {log.before != null && (
                      <div>
                        <p className="mb-1 font-semibold text-muted">Before</p>
                        <pre className="max-h-48 overflow-auto rounded-lg bg-surface2 p-2 text-[10px] text-ink">
                          {JSON.stringify(log.before, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.after != null && (
                      <div>
                        <p className="mb-1 font-semibold text-muted">After</p>
                        <pre className="max-h-48 overflow-auto rounded-lg bg-surface2 p-2 text-[10px] text-ink">
                          {JSON.stringify(log.after, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-xs text-muted">{page} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
