import { db } from '@/lib/db';
import { json, withAuth, parseBody, fail } from '@/lib/api';
import { builderOption } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

type P = { id: string };

export const PATCH = withAuth<P>(
  { permission: 'menu:write', limit: LIMITS.write },
  async ({ req, params, user, ip, userAgent }) => {
    const before = await db.builderOption.findUnique({ where: { id: params.id } });
    if (!before) return fail('Option not found', 404);
    const data = await parseBody(req, builderOption.partial());
    const after = await db.builderOption.update({ where: { id: params.id }, data });
    await writeAudit({
      actor: user, action: 'UPDATE', entity: 'BuilderOption', entityId: after.id,
      summary: after.nameEn, before, after, ip, userAgent,
    });
    return json({ option: after });
  },
);

export const DELETE = withAuth<P>(
  { permission: 'menu:write', limit: LIMITS.write },
  async ({ params, user, ip, userAgent }) => {
    const before = await db.builderOption.findUnique({ where: { id: params.id } });
    if (!before) return fail('Option not found', 404);
    await db.builderOption.delete({ where: { id: params.id } });
    await writeAudit({
      actor: user, action: 'DELETE', entity: 'BuilderOption', entityId: params.id,
      summary: before.nameEn, before, ip, userAgent,
    });
    return json({ ok: true });
  },
);
