'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, UtensilsCrossed, MessageSquare, TrendingUp } from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '@/lib/client';
import { Card, CardBody, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { useLang } from '@/lib/i18n';
import { relativeTime } from '@/lib/utils';

type Stats = {
  totals: { views30d: number; viewsAllTime: number; publishedItems: number; totalItems: number; newMessages: number };
  chart: { date: string; views: number }[];
  topItems: { id: string; nameEn: string; nameAr: string; viewCount: number }[];
  recentActivity: { id: string; actorName: string; action: string; entity: string; summary: string | null; createdAt: string }[];
};

export default function DashboardHome() {
  const { t, lang } = useLang();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>('/api/stats').then(setStats).catch(() => setStats(null));
  }, []);

  const tiles = [
    { label: t('viewsChart'), value: stats?.totals.views30d, icon: Eye, tone: 'text-flame' },
    { label: t('publishedItems'), value: stats?.totals.publishedItems, icon: UtensilsCrossed, tone: 'text-gold-deep' },
    { label: t('newMessages'), value: stats?.totals.newMessages, icon: MessageSquare, tone: 'text-jo-red' },
    { label: 'All-time views', value: stats?.totals.viewsAllTime, icon: TrendingUp, tone: 'text-emerald-600' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-ink">{t('dashboard')}</h1>
        <p className="text-sm text-muted">Baytna Burger — Rainbow Street, Jabal Amman</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile, i) => {
          const Icon = tile.icon;
          return (
            <motion.div
              key={tile.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card>
                <CardBody className="flex items-center gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface2">
                    <Icon size={18} className={tile.tone} />
                  </span>
                  <div className="min-w-0">
                    {tile.value === undefined ? (
                      <Skeleton className="h-7 w-16" />
                    ) : (
                      <p className="font-display text-2xl leading-none text-ink tabular-nums">{tile.value}</p>
                    )}
                    <p className="mt-1 truncate text-[11px] text-muted">{tile.label}</p>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>{t('viewsChart')}</CardTitle></CardHeader>
        <CardBody className="h-64 p-3">
          {!stats ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chart} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="views" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6A1A" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="#FF6A1A" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
                <XAxis
                  dataKey="date" tickLine={false} axisLine={false}
                  tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }}
                  tickFormatter={(d: string) => d.slice(5)}
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false} axisLine={false} allowDecimals={false}
                  tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }} width={44}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))',
                    borderRadius: 10, fontSize: 12, color: 'rgb(var(--ink))',
                  }}
                  labelStyle={{ color: 'rgb(var(--muted))' }}
                />
                <Area type="monotone" dataKey="views" stroke="#FF6A1A" strokeWidth={2} fill="url(#views)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('topItems')}</CardTitle></CardHeader>
          <CardBody className="space-y-2 p-3">
            {!stats ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : stats.topItems.length === 0 ? (
              <p className="p-3 text-sm text-muted">{t('noResults')}</p>
            ) : (
              stats.topItems.map((item, i) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface2">
                  <span className="w-5 text-center font-display text-sm text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {lang === 'ar' ? item.nameAr : item.nameEn}
                  </span>
                  <span className="text-xs tabular-nums text-muted">{item.viewCount}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('recentActivity')}</CardTitle></CardHeader>
          <CardBody className="space-y-2 p-3">
            {!stats ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : stats.recentActivity.length === 0 ? (
              <p className="p-3 text-sm text-muted">{t('noResults')}</p>
            ) : (
              stats.recentActivity.map((log) => (
                <div key={log.id} className="rounded-lg px-2 py-1.5 hover:bg-surface2">
                  <p className="truncate text-xs text-ink">
                    <span className="font-medium">{log.actorName}</span>{' '}
                    <span className="text-muted">{log.action.toLowerCase().replace(/_/g, ' ')}</span>{' '}
                    <span className="text-muted">{log.entity}</span>
                    {log.summary && <span className="text-muted"> — {log.summary}</span>}
                  </p>
                  <p className="text-[10px] text-muted">{relativeTime(log.createdAt, lang)}</p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
