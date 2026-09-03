import { z } from 'zod';
import { db } from '@/lib/db';
import { json, withAuth, fail } from '@/lib/api';
import { processUpload, UploadError } from '@/lib/upload';
import { writeAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/rate-limit';

const query = z.object({
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(24),
});

export const GET = withAuth({ permission: 'media:read' }, async ({ req }) => {
  const { q, page, perPage } = query.parse(Object.fromEntries(req.nextUrl.searchParams));
  const where = q ? { originalName: { contains: q, mode: 'insensitive' as const } } : {};

  const [media, total] = await Promise.all([
    db.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        // so the library can warn before deleting something still in use
        _count: { select: { menuItems: true, heroSlides: true, promotions: true, builderOptions: true, storyBlocks: true } },
        uploadedBy: { select: { name: true } },
      },
    }),
    db.media.count({ where }),
  ]);

  return json({ media, total, page, perPage, pages: Math.ceil(total / perPage) });
});

export const POST = withAuth(
  { permission: 'media:write', limit: LIMITS.upload },
  async ({ req, user, ip, userAgent }) => {
    const form = await req.formData();
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) return fail('No files supplied', 400, 'NO_FILES');
    if (files.length > 20) return fail('Upload at most 20 files at a time', 400, 'TOO_MANY');

    const created = [];
    const errors: { name: string; error: string }[] = [];

    for (const file of files) {
      try {
        const processed = await processUpload(file);
        const row = await db.media.create({ data: { ...processed, uploadedById: user.id } });
        created.push(row);
      } catch (err) {
        // One bad file must not discard the rest of the batch.
        errors.push({
          name: file.name,
          error: err instanceof UploadError ? err.message : 'Could not process this file',
        });
      }
    }

    if (created.length > 0) {
      await writeAudit({
        actor: user, action: 'UPLOAD', entity: 'Media',
        summary: `Uploaded ${created.length} file(s)`,
        after: created.map((m) => ({ id: m.id, filename: m.filename })),
        ip, userAgent,
      });
    }
    return json({ media: created, errors }, created.length ? 201 : 422);
  },
);
