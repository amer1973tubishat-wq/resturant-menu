import { db } from '@/lib/db';
import { json, withAuth, parseBody } from '@/lib/api';
import { settingsUpdate } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

const SINGLETON = 'singleton';

export const GET = withAuth({ permission: 'settings:read' }, async () => {
  const settings = await db.siteSettings.upsert({
    where: { id: SINGLETON },
    create: { id: SINGLETON },
    update: {},
    include: { logo: true, favicon: true, ogImage: true },
  });
  return json({ settings });
});

export const PATCH = withAuth(
  { permission: 'settings:write', limit: LIMITS.write },
  async ({ req, user, ip, userAgent }) => {
    const data = await parseBody(req, settingsUpdate);
    const before = await db.siteSettings.findUnique({ where: { id: SINGLETON } });
    const after = await db.siteSettings.upsert({
      where: { id: SINGLETON },
      create: { id: SINGLETON, ...data },
      update: data,
    });
    await writeAudit({
      actor: user, action: 'UPDATE', entity: 'SiteSettings', entityId: SINGLETON,
      summary: data.maintenanceMode !== undefined
        ? `Maintenance mode ${data.maintenanceMode ? 'on' : 'off'}`
        : 'Settings updated',
      before, after, ip, userAgent,
    });
    return json({ settings: after });
  },
);
