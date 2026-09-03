import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withCors, preflight } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

/** Read-only feed for the public site. Only published, visible content. */
export async function GET(req: NextRequest) {
  const categories = await db.category.findMany({
    where: { isVisible: true },
    orderBy: { order: 'asc' },
    select: {
      id: true, slug: true, nameEn: true, nameAr: true,
      items: {
        where: { isPublished: true },
        orderBy: { order: 'asc' },
        select: {
          id: true, nameEn: true, nameAr: true, descEn: true, descAr: true,
          price: true, badges: true, spiceLevel: true, isAvailable: true,
          image: { select: { url: true, mediumUrl: true, thumbUrl: true, alt: true } },
        },
      },
    },
  });

  const res = NextResponse.json({
    categories: categories.map((c) => ({
      ...c,
      items: c.items.map((i) => ({ ...i, price: Number(i.price) })),
    })),
  });
  res.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
  return withCors(req, res);
}
