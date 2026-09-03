import { z } from 'zod';

/**
 * Fail fast at boot rather than at the first request. A missing or weak
 * secret is a deploy-blocking error, not a warning.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),

  // 32+ chars each. Separate keys so rotating one does not invalidate the other.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters'),
  // 64 hex chars = 32 bytes, used to encrypt TOTP secrets at rest
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex characters'),

  APP_URL: z.string().url().default('http://localhost:3001'),
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),

  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  IDLE_TIMEOUT_MIN: z.coerce.number().int().positive().default(30),

  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  UPLOAD_DIR: z.string().default('./public/uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),

  // Optional integrations — the app degrades gracefully without them.
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Baytna Burger <no-reply@baytnaburger.jo>'),
  HIBP_ENABLED: z.enum(['true', 'false']).default('true'),
  CLOUDINARY_URL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
