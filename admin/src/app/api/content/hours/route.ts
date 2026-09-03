import { db } from '@/lib/db';
import { json, withAuth, parseBody } from '@/lib/api';
import { openingHours } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

export const GET = withAuth({ permission: 'content:read' }, async () => {
  const hours = await db.openingHours.findMany({ orderBy: { dayOfWeek: 'asc' } });
  return json({ hours });
});

export const PUT = withAuth(
  { permission: 'content:write', limit: LIMITS.write },
  async ({ req, user, ip, userAgent }) => {
    const { days } = await parseBody(req, openingHours);
    const before = await db.openingHours.findMany({ orderBy: { dayOfWeek: 'asc' } });

    await db.$transaction(
      days.map((d) =>
        db.openingHours.upsert({
          where: { dayOfWeek: d.dayOfWeek },
          create: d,
          update: { openMinutes: d.openMinutes, closeMinutes: d.closeMinutes, isClosed: d.isClosed },
        }),
      ),
    );

    await writeAudit({
      actor: user, action: 'UPDATE', entity: 'OpeningHours',
      summary: 'Opening hours updated', before, after: days, ip, userAgent,
    });
    return json({ ok: true });
  },
);
