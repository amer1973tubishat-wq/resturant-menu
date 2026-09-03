import { db } from '@/lib/db';
import { json, withAuth, parseBody, fail } from '@/lib/api';
import { menuItemUpdate } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';
import { sendMail, templates } from '@/lib/mailer';

type P = { id: string };

export const GET = withAuth<P>({ permission: 'menu:read' }, async ({ params }) => {
  const item = await db.menuItem.findUnique({
    where: { id: params.id },
    include: { category: true, image: true },
  });
  if (!item) return fail('Item not found', 404);
  return json({ item });
});

export const PATCH = withAuth<P>(
  { permission: 'menu:write', limit: LIMITS.write },
  async ({ req, params, user, ip, userAgent }) => {
    const before = await db.menuItem.findUnique({ where: { id: params.id } });
    if (!before) return fail('Item not found', 404);

    const data = await parseBody(req, menuItemUpdate);
    const after = await db.menuItem.update({ where: { id: params.id }, data });
    await writeAudit({
      actor: user, action: 'UPDATE', entity: 'MenuItem', entityId: after.id,
      summary: after.nameEn, before, after, ip, userAgent,
    });
    return json({ item: after });
  },
);

export const DELETE = withAuth<P>(
  { permission: 'menu:write', limit: LIMITS.write },
  async ({ params, user, ip, userAgent }) => {
    const before = await db.menuItem.findUnique({ where: { id: params.id } });
    if (!before) return fail('Item not found', 404);

    await db.menuItem.delete({ where: { id: params.id } });
    await writeAudit({
      actor: user, action: 'DELETE', entity: 'MenuItem', entityId: params.id,
      summary: before.nameEn, before, ip, userAgent,
    });
    await sendMail({ to: user.email, ...templates.itemDeleted(user.name, 'menu item', before.nameEn) });
    return json({ ok: true });
  },
);
