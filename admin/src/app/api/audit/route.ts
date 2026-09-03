import { z } from 'zod';
import { db } from '@/lib/db';
import { json, withAuth } from '@/lib/api';

const query = z.object({
  q: z.string().max(120).optional(),
  entity: z.string().max(40).optional(),
  action: z.string().max(40).optional(),
  userId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
});

export const GET = withAuth({ permission: 'audit:read' }, async ({ req }) => {
  const p = query.parse(Object.fromEntries(req.nextUrl.searchParams));

  const where = {
    ...(p.entity ? { entity: p.entity } : {}),
    ...(p.action ? { action: p.action } : {}),
    ...(p.userId ? { userId: p.userId } : {}),
    ...(p.from || p.to
      ? { createdAt: { ...(p.from ? { gte: p.from } : {}), ...(p.to ? { lte: p.to } : {}) } }
      : {}),
    ...(p.q
      ? {
          OR: [
            { summary: { contains: p.q, mode: 'insensitive' as const } },
            { actorName: { contains: p.q, mode: 'insensitive' as const } },
            { entityId: p.q },
          ],
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (p.page - 1) * p.perPage, take: p.perPage,
    }),
    db.auditLog.count({ where }),
  ]);

  return json({ logs, total, page: p.page, perPage: p.perPage, pages: Math.ceil(total / p.perPage) });
});
