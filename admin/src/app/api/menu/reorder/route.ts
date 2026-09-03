import { z } from 'zod';
import { db } from '@/lib/db';
import { json, withAuth, parseBody } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

const schema = z.object({
  type: z.enum(['category', 'item']),
  ids: z.array(z.string().min(1)).min(1).max(500),
});

/**
 * Drag-and-drop sends the full ordered list of ids. Writing them in one
 * transaction means a half-applied order can never be persisted.
 */
export const POST = withAuth(
  { permission: 'menu:write', limit: LIMITS.write },
  async ({ req, user, ip, userAgent }) => {
    const { type, ids } = await parseBody(req, schema);

    await db.$transaction(
      ids.map((id, index) =>
        type === 'category'
          ? db.category.update({ where: { id }, data: { order: index } })
          : db.menuItem.update({ where: { id }, data: { order: index } }),
      ),
    );

    await writeAudit({
      actor: user, action: 'REORDER', entity: type === 'category' ? 'Category' : 'MenuItem',
      summary: `Reordered ${ids.length} ${type}(s)`, after: { ids }, ip, userAgent,
    });
    return json({ ok: true });
  },
);
