import { db } from '@/lib/db';
import { json, withAuth, parseBody } from '@/lib/api';
import { builderStep } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

export const GET = withAuth({ permission: 'menu:read' }, async () => {
  const steps = await db.builderStep.findMany({
    orderBy: { order: 'asc' },
    include: { options: { orderBy: { order: 'asc' }, include: { media: true } } },
  });
  return json({ steps });
});

export const POST = withAuth(
  { permission: 'menu:write', limit: LIMITS.write },
  async ({ req, user, ip, userAgent }) => {
    const data = await parseBody(req, builderStep);
    const last = await db.builderStep.findFirst({ orderBy: { order: 'desc' }, select: { order: true } });
    const created = await db.builderStep.create({ data: { ...data, order: (last?.order ?? -1) + 1 } });
    await writeAudit({
      actor: user, action: 'CREATE', entity: 'BuilderStep', entityId: created.id,
      summary: created.nameEn, after: created, ip, userAgent,
    });
    return json({ step: created }, 201);
  },
);
