import { db } from '@/lib/db';
import { json, withAuth, parseBody, fail } from '@/lib/api';
import { categoryUpdate } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

type P = { id: string };

export const PATCH = withAuth<P>(
  { permission: 'menu:write', limit: LIMITS.write },
  async ({ req, params, user, ip, userAgent }) => {
    const before = await db.category.findUnique({ where: { id: params.id } });
    if (!before) return fail('Category not found', 404);

    const data = await parseBody(req, categoryUpdate);
    const after = await db.category.update({ where: { id: params.id }, data });
    await writeAudit({
      actor: user, action: 'UPDATE', entity: 'Category', entityId: after.id,
      summary: after.nameEn, before, after, ip, userAgent,
    });
    return json({ category: after });
  },
);

export const DELETE = withAuth<P>(
  { permission: 'menu:write', limit: LIMITS.write },
  async ({ params, user, ip, userAgent }) => {
    const before = await db.category.findUnique({
      where: { id: params.id },
      include: { _count: { select: { items: true } } },
    });
    if (!before) return fail('Category not found', 404);

    // Deleting a category cascades to its items, so make the caller move
    // them first rather than silently destroying the menu.
    if (before._count.items > 0) {
      return fail(
        `This category still has ${before._count.items} item(s). Move or delete them first.`,
        409,
        'CATEGORY_NOT_EMPTY',
      );
    }

    await db.category.delete({ where: { id: params.id } });
    await writeAudit({
      actor: user, action: 'DELETE', entity: 'Category', entityId: params.id,
      summary: before.nameEn, before, ip, userAgent,
    });
    return json({ ok: true });
  },
);
