# Baytna Burger — Admin Dashboard

A standalone Next.js 14 admin panel that controls every piece of content on the
public site. Nothing on the site needs a code change to update.

- **Stack** — Next.js 14 (App Router) · TypeScript (strict) · Tailwind · Prisma · PostgreSQL · Framer Motion
- **Auth** — Argon2id, access + refresh JWTs, TOTP 2FA with backup codes, RBAC, audit log
- **Runs on** — `http://localhost:3001` (the public site is `:3000`)

---

## Quick start

```bash
# 1. Postgres
createdb baytna_admin

# 2. Configure
cp .env.example .env
#    then generate real secrets:
node -e "console.log('JWT_ACCESS_SECRET=\"'+require('crypto').randomBytes(48).toString('base64url')+'\"')"
node -e "console.log('JWT_REFRESH_SECRET=\"'+require('crypto').randomBytes(48).toString('base64url')+'\"')"
node -e "console.log('CSRF_SECRET=\"'+require('crypto').randomBytes(48).toString('base64url')+'\"')"
node -e "console.log('ENCRYPTION_KEY=\"'+require('crypto').randomBytes(32).toString('hex')+'\"')"

# 3. Install, migrate, seed
npm install
npm run db:migrate
npm run db:seed      # prints the Super Admin password once

# 4. Run
npm run dev          # http://localhost:3001
```

The seed prints a generated password **once**. Sign in with it and you are sent
straight to a forced password change — the account cannot reach any other page
until that is done.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on :3001 |
| `npm run build` / `start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | First Super Admin plus baseline content |
| `npm run db:studio` | Prisma Studio |
| `npm run db:backup` | `pg_dump` into `backups/` |
| `npm run db:restore -- <file>` | Restore a dump (asks for confirmation) |

---

## Security

The measures below are implemented and covered by the test scripts in the repo
root of this folder (`tests/authtest.mjs`, `tests/sectest.mjs`, `tests/locktest.mjs`).

### Passwords
- **Argon2id**, 19 MiB / t=2 / p=1 (the OWASP floor). Plaintext is never stored.
- Minimum 12 characters with upper, lower, digit and symbol.
- Checked against **Have I Been Pwned** using k-anonymity — only the first five
  characters of the SHA-1 leave the process, so the password never does. If the
  API is unreachable the check is skipped rather than blocking a legitimate change.
- A failed login against a non-existent account still runs a full Argon2id
  verification against a decoy hash, so response timing does not reveal which
  addresses are registered.

### Sessions
- 15-minute access JWT (HS256, algorithm pinned) + opaque refresh token stored
  only as a SHA-256 hash.
- Cookies are `httpOnly`, `Secure` in production, `SameSite=Strict`.
- Refresh tokens **rotate** on every use. Presenting an already-rotated token is
  treated as theft and revokes every session for that user.
- 30-minute idle timeout, enforced against the session row rather than the token.
- "Sign out of all devices" revokes every session at once.
- `mustChangePassword` is read from the database on each request, so an admin's
  forced reset takes effect immediately rather than when the token expires.

### Two-factor
- TOTP (Google Authenticator and compatible), secrets encrypted at rest with
  AES-256-GCM under `ENCRYPTION_KEY`.
- Enabling requires proving a valid code first, so a mis-scanned QR cannot lock
  anyone out.
- Ten single-use backup codes, shown once and stored as Argon2id hashes.
- While 2FA is pending the session can reach exactly one route: the verify endpoint.

### Brute force
- Per-account lockout after **5** failed attempts, with exponential backoff
  (5 → 10 → 20 → 40 → 60 minutes) and an email notification. An attacker rotating
  IPs still hits this.
- Per-IP rate limits on login, reset, 2FA, upload and writes. The login limit is
  deliberately loose (40 / 15 min) because staff share one office IP — the
  per-account lockout is the precise control, not the IP limit.

### Application
- CSRF: signed double-submit token required on every mutating request.
- CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS in production, and no
  `X-Powered-By`.
- All queries go through Prisma's parameterised client — no string-built SQL.
- Rich text is sanitised with an allow-list on write, so unknown tags are denied
  by default. Everything else is plain text with control characters stripped.
- Uploads are validated by **magic bytes**, not extension or Content-Type:
  5 MB cap, images only (SVG rejected — it is a script vector), re-encoded to
  WebP, EXIF stripped (which also removes GPS), and written under a random name.
- CORS on public endpoints is restricted to `PUBLIC_SITE_URL`; origins are matched
  exactly, never reflected.

### Accountability
- Every write records who, what, before, after, IP, device and time. Password and
  secret fields are redacted before the entry is written.
- Emails on new-device sign-in, password change, lockout and important deletions.
  Without `SMTP_URL` these are written to the server log instead of silently lost.

### Guard rails
You cannot change your own role, deactivate or delete your own account, or remove
the last active Super Admin.

---

## Structure

```
admin/
├── prisma/
│   ├── schema.prisma        # 20 models — see docs/SCHEMA.md
│   └── seed.ts              # first Super Admin + baseline content
├── scripts/restore.ts
├── docs/
│   ├── API.md               # every endpoint and its permission
│   └── SCHEMA.md            # data model and relationships
└── src/
    ├── middleware.ts        # security headers + coarse route gate
    ├── lib/                 # env, db, crypto, password, jwt, session,
    │                        # rbac, audit, rate-limit, csrf, totp, upload,
    │                        # sanitize, cors, mailer, schemas
    ├── components/          # shell, UI primitives, toast/confirm
    └── app/
        ├── login, two-factor, change-password
        ├── (dash)/          # dashboard, menu, hero, media, content,
        │                    # messages, users, audit, settings
        └── api/             # auth, menu, media, hero, content, builder,
                             # messages, users, audit, settings, stats,
                             # backup, public
```

## Deploying

1. Set every variable in `.env.example`; the app refuses to boot if a secret is
   missing or too short.
2. `npm run db:deploy && npm run build && npm start`.
3. Terminate TLS at your proxy and forward `X-Forwarded-For` — rate limiting and
   the audit log read the client IP from it.
4. Point `PUBLIC_SITE_URL` at the real site so CORS admits it.
5. Uploads are written to `UPLOAD_DIR` on local disk. On a platform with an
   ephemeral filesystem, mount a volume or switch `src/lib/upload.ts` to S3 or
   Cloudinary — the interface is one function.
6. Schedule `npm run db:backup` daily (cron or a platform scheduler).

## Connecting the public site

The site reads two endpoints and needs no build step to pick up changes:

```js
const menu = await fetch(`${ADMIN_URL}/api/public/menu`).then(r => r.json());
const site = await fetch(`${ADMIN_URL}/api/public/site`).then(r => r.json());
```

`/api/public/site` returns settings, opening hours, hero slides, the story block,
social links, currently-live promotions and the burger builder. Both responses
carry a 30-second cache header.
