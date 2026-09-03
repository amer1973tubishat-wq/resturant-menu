import { z } from 'zod';
import { db } from '@/lib/db';
import { json, withAuth, parseBody, fail } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

type P = { id: string };
const schema = z.object({ status: z.enum(['NEW', 'READ', 'REPLIED']) });

export const PATCH = withAuth<P>(
  { permission: 'messages:write', limit: LIMITS.write },
  async ({ req, params, user, ip, userAgent }) => {
    const before = await db.message.findUnique({ where: { id: params.id } });
    if (!before) return fail('Message not found', 404);
    const { status } = await parseBody(req, schema);
    const after = await db.message.update({ where: { id: params.id }, data: { status } });
    await writeAudit({
      actor: user, action: 'UPDATE', entity: 'Message', entityId: after.id,
      summary: `Marked ${status.toLowerCase()}`, before, after, ip, userAgent,
    });
    return json({ message: after });
  },
);

export const DELETE = withAuth<P>(
  { permission: 'messages:write', limit: LIMITS.write },
  async ({ params, user, ip, userAgent }) => {
    const before = await db.message.findUnique({ where: { id: params.id } });
    if (!before) return fail('Message not found', 404);
    await db.message.delete({ where: { id: params.id } });
    await writeAudit({
      actor: user, action: 'DELETE', entity: 'Message', entityId: params.id,
      summary: `From ${before.name}`, before, ip, userAgent,
    });
    return json({ ok: true });
  },
);
