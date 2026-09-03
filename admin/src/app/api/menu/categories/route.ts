import { db } from '@/lib/db';
import { json, withAuth, parseBody } from '@/lib/api';
import { categoryCreate } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

export const GET = withAuth({ permission: 'menu:read' }, async () => {
  const categories = await db.category.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { items: true } } },
  });
  return json({ categories });
});

export const POST = withAuth(
  { permission: 'menu:write', limit: LIMITS.write },
  async ({ req, user, ip, userAgent }) => {
    const data = await parseBody(req, categoryCreate);
    const last = await db.category.findFirst({ orderBy: { order: 'desc' }, select: { order: true } });
    const created = await db.category.create({
      data: { ...data, order: (last?.order ?? -1) + 1 },
    });
    await writeAudit({
      actor: user, action: 'CREATE', entity: 'Category', entityId: created.id,
      summary: created.nameEn, after: created, ip, userAgent,
    });
    return json({ category: created }, 201);
  },
);
