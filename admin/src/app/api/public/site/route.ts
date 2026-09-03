import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withCors, preflight } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

/** Everything else the public site renders, in one round trip. */
export async function GET(req: NextRequest) {
  const now = new Date();

  const [settings, hours, slides, story, social, promos, steps] = await Promise.all([
    db.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
      include: { logo: true, favicon: true, ogImage: true },
    }),
    db.openingHours.findMany({ orderBy: { dayOfWeek: 'asc' } }),
    db.heroSlide.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, include: { media: true } }),
    db.storyBlock.findUnique({ where: { key: 'about' }, include: { media: true } }),
    db.socialLink.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    // a promotion appears and disappears on its own dates, with no manual step
    db.promotion.findMany({
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { startsAt: 'desc' },
      include: { media: true },
    }),
    db.builderStep.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        options: { where: { isActive: true }, orderBy: { order: 'asc' }, include: { media: true } },
      },
    }),
  ]);

  const res = NextResponse.json({
    settings: {
      ...settings,
      // never expose internal ids/timestamps the site has no use for
      updatedAt: undefined,
    },
    hours,
    hero: slides,
    story,
    social,
    promotions: promos,
    builder: steps.map((s) => ({
      ...s,
      options: s.options.map((o) => ({ ...o, price: Number(o.price) })),
    })),
  });
  res.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
  return withCors(req, res);
}
