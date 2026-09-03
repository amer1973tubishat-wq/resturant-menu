import { db } from '@/lib/db';
import { json, withAuth, parseBody } from '@/lib/api';
import { heroSlide } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

export const GET = withAuth({ permission: 'content:read' }, async () => {
  const slides = await db.heroSlide.findMany({ orderBy: { order: 'asc' }, include: { media: true } });
  return json({ slides });
});

export const POST = withAuth(
  { permission: 'content:write', limit: LIMITS.write },
  async ({ req, user, ip, userAgent }) => {
    const data = await parseBody(req, heroSlide);
    const last = await db.heroSlide.findFirst({ orderBy: { order: 'desc' }, select: { order: true } });
    const created = await db.heroSlide.create({
      data: { ...data, videoUrl: data.videoUrl || null, order: (last?.order ?? -1) + 1 },
    });
    await writeAudit({
      actor: user, action: 'CREATE', entity: 'HeroSlide', entityId: created.id,
      summary: created.titleEn || 'Hero slide', after: created, ip, userAgent,
    });
    return json({ slide: created }, 201);
  },
);
