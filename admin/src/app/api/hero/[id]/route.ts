import { db } from '@/lib/db';
import { json, withAuth, parseBody, fail } from '@/lib/api';
import { heroSlide } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

type P = { id: string };

export const PATCH = withAuth<P>(
  { permission: 'content:write', limit: LIMITS.write },
  async ({ req, params, user, ip, userAgent }) => {
    const before = await db.heroSlide.findUnique({ where: { id: params.id } });
    if (!before) return fail('Slide not found', 404);
    const data = await parseBody(req, heroSlide.partial());
    const after = await db.heroSlide.update({
      where: { id: params.id },
      data: { ...data, ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl || null } : {}) },
    });
    await writeAudit({
      actor: user, action: 'UPDATE', entity: 'HeroSlide', entityId: after.id,
      summary: after.titleEn || 'Hero slide', before, after, ip, userAgent,
    });
    return json({ slide: after });
  },
);

export const DELETE = withAuth<P>(
  { permission: 'content:write', limit: LIMITS.write },
  async ({ params, user, ip, userAgent }) => {
    const before = await db.heroSlide.findUnique({ where: { id: params.id } });
    if (!before) return fail('Slide not found', 404);
    await db.heroSlide.delete({ where: { id: params.id } });
    await writeAudit({
      actor: user, action: 'DELETE', entity: 'HeroSlide', entityId: params.id,
      summary: before.titleEn || 'Hero slide', before, ip, userAgent,
    });
    return json({ ok: true });
  },
);
