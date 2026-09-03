import { db } from '@/lib/db';
import { json, withAuth } from '@/lib/api';

export const GET = withAuth({ permission: 'menu:read' }, async () => {
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [totalViews, viewsWindow, publishedItems, totalItems, newMessages, topItems, recentActivity] =
    await Promise.all([
      db.pageView.count(),
      db.pageView.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      db.menuItem.count({ where: { isPublished: true } }),
      db.menuItem.count(),
      db.message.count({ where: { status: 'NEW' } }),
      db.menuItem.findMany({
        orderBy: { viewCount: 'desc' }, take: 5,
        select: { id: true, nameEn: true, nameAr: true, viewCount: true },
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' }, take: 8,
        select: { id: true, actorName: true, action: true, entity: true, summary: true, createdAt: true },
      }),
    ]);

  // Bucket by day in one pass, seeding every day so the chart has no gaps.
  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const v of viewsWindow) {
    const key = v.createdAt.toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  return json({
    totals: {
      views30d: viewsWindow.length,
      viewsAllTime: totalViews,
      publishedItems,
      totalItems,
      newMessages,
    },
    chart: [...byDay.entries()].map(([date, views]) => ({ date, views })),
    topItems,
    recentActivity,
  });
});
