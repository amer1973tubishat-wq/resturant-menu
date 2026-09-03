import { z } from 'zod';
import { db } from '@/lib/db';
import { json, withAuth, parseBody } from '@/lib/api';
import { menuItemCreate } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

const query = z.object({
  q: z.string().max(120).optional(),
  categoryId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  published: z.enum(['all', 'yes', 'no']).default('all'),
});

export const GET = withAuth({ permission: 'menu:read' }, async ({ req }) => {
  const { q, categoryId, page, perPage, published } = query.parse(
    Object.fromEntries(req.nextUrl.searchParams),
  );

  const where = {
    ...(categoryId ? { categoryId } : {}),
    ...(published === 'all' ? {} : { isPublished: published === 'yes' }),
    ...(q
      ? {
          OR: [
            // Prisma parameterises these — no string concatenation reaches SQL.
            { nameEn: { contains: q, mode: 'insensitive' as const } },
            { nameAr: { contains: q } },
            { descEn: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.menuItem.findMany({
      where,
      orderBy: [{ categoryId: 'asc' }, { order: 'asc' }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: { category: { select: { id: true, nameEn: true, nameAr: true } }, image: true },
    }),
    db.menuItem.count({ where }),
  ]);

  return json({ items, total, page, perPage, pages: Math.ceil(total / perPage) });
});

export const POST = withAuth(
  { permission: 'menu:write', limit: LIMITS.write },
  async ({ req, user, ip, userAgent }) => {
    const data = await parseBody(req, menuItemCreate);
    const last = await db.menuItem.findFirst({
      where: { categoryId: data.categoryId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const created = await db.menuItem.create({
      data: { ...data, order: (last?.order ?? -1) + 1 },
    });
    await writeAudit({
      actor: user, action: 'CREATE', entity: 'MenuItem', entityId: created.id,
      summary: created.nameEn, after: created, ip, userAgent,
    });
    return json({ item: created }, 201);
  },
);
