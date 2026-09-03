import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { withCors, preflight } from '@/lib/cors';
import { rateLimit } from '@/lib/rate-limit';
import { sha256 } from '@/lib/crypto';
import { getIp } from '@/lib/api';

const schema = z.object({ path: z.string().max(200), itemId: z.string().max(40).optional() });

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

/** Analytics beacon. The IP is hashed, so views can be counted but not traced. */
export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const limited = rateLimit(`view:${ip}`, 60, 60_000);
  if (!limited.allowed) return withCors(req, NextResponse.json({ ok: true }));

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return withCors(req, NextResponse.json({ ok: true }));

  const { path, itemId } = parsed.data;
  await db.pageView.create({ data: { path, itemId: itemId ?? null, ipHash: sha256(ip).slice(0, 32) } });
  if (itemId) {
    await db.menuItem.updateMany({ where: { id: itemId }, data: { viewCount: { increment: 1 } } });
  }
  return withCors(req, NextResponse.json({ ok: true }));
}
