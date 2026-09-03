import { db } from '@/lib/db';
import { json, withAuth, fail } from '@/lib/api';
import { deleteUploadFiles } from '@/lib/upload';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

type P = { id: string };

export const DELETE = withAuth<P>(
  { permission: 'media:delete', limit: LIMITS.write },
  async ({ params, user, ip, userAgent }) => {
    const media = await db.media.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { menuItems: true, heroSlides: true, promotions: true, builderOptions: true, storyBlocks: true } },
      },
    });
    if (!media) return fail('File not found', 404);

    const uses =
      media._count.menuItems + media._count.heroSlides + media._count.promotions +
      media._count.builderOptions + media._count.storyBlocks;

    // Refuse rather than leave the site with broken images.
    if (uses > 0) {
      return fail(
        `This image is used in ${uses} place(s). Replace it there before deleting.`,
        409,
        'MEDIA_IN_USE',
      );
    }

    await db.media.delete({ where: { id: params.id } });
    await deleteUploadFiles(media.filename);

    await writeAudit({
      actor: user, action: 'DELETE', entity: 'Media', entityId: params.id,
      summary: media.originalName, before: media, ip, userAgent,
    });
    return json({ ok: true });
  },
);
