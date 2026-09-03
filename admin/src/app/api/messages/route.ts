import { z } from 'zod';
import { db } from '@/lib/db';
import { json, withAuth } from '@/lib/api';

const query = z.object({
  status: z.enum(['all', 'NEW', 'READ', 'REPLIED']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = withAuth({ permission: 'messages:read' }, async ({ req }) => {
  const { status, page, perPage } = query.parse(Object.fromEntries(req.nextUrl.searchParams));
  const where = status === 'all' ? {} : { status };

  const [messages, total, unread] = await Promise.all([
    db.message.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage, take: perPage,
    }),
    db.message.count({ where }),
    db.message.count({ where: { status: 'NEW' } }),
  ]);
  return json({ messages, total, unread, page, perPage, pages: Math.ceil(total / perPage) });
});
