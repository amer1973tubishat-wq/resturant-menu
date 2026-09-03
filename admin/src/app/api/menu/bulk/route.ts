import { db } from '@/lib/db';
import { json, withAuth, parseBody } from '@/lib/api';
import { bulkAction } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

export const POST = withAuth(
  { permission: 'menu:write', limit: LIMITS.write },
  async ({ req, user, ip, userAgent }) => {
    const { ids, action } = await parseBody(req, bulkAction);
    const before = await db.menuItem.findMany({ where: { id: { in: ids } } });
    if (before.length === 0) return json({ ok: true, affected: 0 });

    let affected = 0;

    if (action === 'duplicate') {
      // Copies land unpublished so a half-finished duplicate never appears live.
      const copies = await Promise.all(
        before.map(async (item) => {
          const last = await db.menuItem.findFirst({
            where: { categoryId: item.categoryId },
            orderBy: { order: 'desc' },
            select: { order: true },
          });
          const { id: _id, createdAt: _c, updatedAt: _u, viewCount: _v, ...rest } = item;
          return db.menuItem.create({
            data: {
              ...rest,
              nameEn: `${item.nameEn} (copy)`,
              nameAr: `${item.nameAr} (نسخة)`,
              isPublished: false,
              order: (last?.order ?? -1) + 1,
            },
          });
        }),
      );
      affected = copies.length;
    } else if (action === 'delete') {
      affected = (await db.menuItem.deleteMany({ where: { id: { in: ids } } })).count;
    } else {
      const data =
        action === 'publish' ? { isPublished: true }
        : action === 'unpublish' ? { isPublished: false }
        : action === 'available' ? { isAvailable: true }
        : { isAvailable: false };
      affected = (await db.menuItem.updateMany({ where: { id: { in: ids } }, data })).count;
    }

    await writeAudit({
      actor: user, action: `BULK_${action.toUpperCase()}`, entity: 'MenuItem',
      summary: `${action} on ${affected} item(s)`,
      before: before.map((b) => ({ id: b.id, nameEn: b.nameEn })),
      ip, userAgent,
    });
    return json({ ok: true, affected });
  },
);
