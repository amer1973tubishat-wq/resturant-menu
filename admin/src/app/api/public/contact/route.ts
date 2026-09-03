import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { withCors, preflight } from '@/lib/cors';
import { rateLimit } from '@/lib/rate-limit';
import { getIp } from '@/lib/api';
import { cleanText } from '@/lib/sanitize';

const schema = z.object({
  name: z.string().min(1).max(120).transform((v) => cleanText(v, 120)),
  email: z.string().email().max(200).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  body: z.string().min(1).max(3000).transform((v) => cleanText(v, 3000)),
  type: z.enum(['CONTACT', 'WHATSAPP_ORDER']).default('CONTACT'),
  // honeypot: real users never fill a hidden field
  company: z.string().max(100).optional(),
});

export function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const limited = rateLimit(`contact:${ip}`, 5, 10 * 60_000);
  if (!limited.allowed) {
    return withCors(req, NextResponse.json(
      { error: 'Too many messages. Please try again later.' },
      { status: 429 },
    ));
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: 'Invalid submission' }, { status: 422 }));
  }
  // Silently accept spam so the bot does not learn it was caught.
  if (parsed.data.company) return withCors(req, NextResponse.json({ ok: true }));

  const { name, email, phone, body, type } = parsed.data;
  await db.message.create({
    data: { name, email: email || null, phone: phone || null, body, type },
  });
  return withCors(req, NextResponse.json({ ok: true }, { status: 201 }));
}
