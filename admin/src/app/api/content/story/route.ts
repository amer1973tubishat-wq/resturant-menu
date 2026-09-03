import { db } from '@/lib/db';
import { json, withAuth, parseBody } from '@/lib/api';
import { storyBlock } from '@/lib/schemas';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

export const GET = withAuth({ permission: 'content:read' }, async () => {
  const story = await db.storyBlock.findUnique({ where: { key: 'about' }, include: { media: true } });
  return json({ story });
});

export const PUT = withAuth(
  { permission: 'content:write', limit: LIMITS.write },
  async ({ req, user, ip, userAgent }) => {
    const data = await parseBody(req, storyBlock); // bodyEn/bodyAr already sanitised by the schema
    const before = await db.storyBlock.findUnique({ where: { key: 'about' } });
    const after = await db.storyBlock.upsert({
      where: { key: 'about' },
      create: { key: 'about', ...data },
      update: data,
    });
    await writeAudit({
      actor: user, action: 'UPDATE', entity: 'StoryBlock', entityId: after.id,
      summary: 'About / our story', before, after, ip, userAgent,
    });
    return json({ story: after });
  },
);
