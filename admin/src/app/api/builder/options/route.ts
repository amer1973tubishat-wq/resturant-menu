import { db } from '@/lib/db';
import { json, withAuth, parseBody } from '@/lib/api';
import { builderOption } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

export const POST = withAuth(
  { permission: 'menu:write', limit: LIMITS.write },
  async ({ req, user, ip, userAgent }) => {
    const data = await parseBody(req, builderOption);
    const last = await db.builderOption.findFirst({
      where: { stepId: data.stepId }, orderBy: { order: 'desc' }, select: { order: true },
    });
    const created = await db.builderOption.create({ data: { ...data, order: (last?.order ?? -1) + 1 } });
    await writeAudit({
      actor: user, action: 'CREATE', entity: 'BuilderOption', entityId: created.id,
      summary: created.nameEn, after: created, ip, userAgent,
    });
    return json({ option: created }, 201);
  },
);
