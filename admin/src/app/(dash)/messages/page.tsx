'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, Mail, MailOpen, CheckCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/client';
import { Badge, Button, Card, CardBody, Skeleton } from '@/components/ui';
import { useUi } from '@/components/ui/toast';
import { useLang } from '@/lib/i18n';
import { relativeTime } from '@/lib/utils';

type Message = {
  id: string; type: string; name: string; email: string | null; phone: string | null;
  body: string; status: 'NEW' | 'READ' | 'REPLIED'; createdAt: string;
};

export default function MessagesPage() {
  const { t, lang } = useLang();
  const { toast, confirm } = useUi();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'NEW' | 'READ' | 'REPLIED'>('all');

  const load = useCallback(async () => {
    const res = await api<{ messages: Message[] }>(`/api/messages?status=${filter}&perPage=50`);
    setMessages(res.messages);
  }, [filter]);

  useEffect(() => { load().catch(() => setMessages([])); }, [load]);

  async function setStatus(m: Message, status: Message['status']) {
    try {
      await api(`/api/messages/${m.id}`, { method: 'PATCH', json: { status } });
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update', 'error');
    }
  }

  async function remove(m: Message) {
    const ok = await confirm({ title: `Delete message from ${m.name}?`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api(`/api/messages/${m.id}`, { method: 'DELETE' });
      toast('Deleted');
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-ink">{t('messages')}</h1>
        <p className="text-sm text-muted">Contact form and WhatsApp order enquiries</p>
      </div>

      <div className="flex gap-1.5">
        {(['all', 'NEW', 'READ', 'REPLIED'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'primary' : 'outline'} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.toLowerCase()}
          </Button>
        ))}
      </div>

      {!messages ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : messages.length === 0 ? (
        <Card><CardBody className="py-12 text-center text-sm text-muted">{t('noResults')}</CardBody></Card>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <Card key={m.id} className={m.status === 'NEW' ? 'border-flame/40' : undefined}>
              <CardBody className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink">{m.name}</p>
                  <Badge tone={m.status === 'NEW' ? 'flame' : m.status === 'REPLIED' ? 'green' : 'neutral'}>
                    {m.status.toLowerCase()}
                  </Badge>
                  {m.type === 'WHATSAPP_ORDER' && <Badge tone="gold">order</Badge>}
                  <span className="ms-auto text-[11px] text-muted">{relativeTime(m.createdAt, lang)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted">{m.body}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                  {m.email && <a href={`mailto:${m.email}`} className="hover:text-flame">{m.email}</a>}
                  {m.phone && <a href={`tel:${m.phone}`} dir="ltr" className="hover:text-flame">{m.phone}</a>}
                  <div className="ms-auto flex gap-1">
                    <button onClick={() => setStatus(m, 'READ')} className="grid h-7 w-7 place-items-center rounded text-muted hover:text-ink" aria-label="Mark read">
                      <MailOpen size={13} />
                    </button>
                    <button onClick={() => setStatus(m, 'REPLIED')} className="grid h-7 w-7 place-items-center rounded text-muted hover:text-emerald-600" aria-label="Mark replied">
                      <CheckCheck size={13} />
                    </button>
                    <button onClick={() => setStatus(m, 'NEW')} className="grid h-7 w-7 place-items-center rounded text-muted hover:text-flame" aria-label="Mark unread">
                      <Mail size={13} />
                    </button>
                    <button onClick={() => remove(m)} className="grid h-7 w-7 place-items-center rounded text-muted hover:text-jo-red" aria-label="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
