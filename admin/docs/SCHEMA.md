# Data model

20 tables. Postgres via Prisma; the source of truth is `prisma/schema.prisma`.

## Authentication

```
User ─┬─< Session          refresh tokens, one row per signed-in device
      ├─< BackupCode       single-use 2FA fallbacks (Argon2id hashes)
      ├─< PasswordResetToken   15-minute, single-use
      ├─< KnownDevice      drives the "new sign-in" email
      ├─< AuditLog         who did what
      ├─< Media            uploads
      └─< User             createdBy (self-relation)

LoginAttempt   standalone; feeds rate limiting and the lockout backoff
```

**User** carries the security state directly: `passwordHash`, `role`,
`isActive`, `mustChangePassword`, `twoFactorEnabled`, `twoFactorSecret`
(AES-256-GCM ciphertext), `failedAttempts`, `lockedUntil`, `lastLoginAt`,
`lastLoginIp`.

Sessions store `tokenHash` (SHA-256) — never the token — plus `expiresAt`,
`lastSeenAt` for the idle timeout, and `revokedAt`.

## Content

```
Category ──< MenuItem >── Media
BuilderStep ──< BuilderOption >── Media
HeroSlide  >── Media
Promotion  >── Media
StoryBlock >── Media
SiteSettings >── Media  (logo, favicon, ogImage)
OpeningHours   one row per weekday
SocialLink     ordered list
Message        contact form and WhatsApp enquiries
PageView       analytics; IP stored hashed
```

### Conventions

- **Bilingual fields** are paired columns: `nameEn`/`nameAr`, `descEn`/`descAr`.
  Language is a presentation concern, so both always exist on the row.
- **Ordering** is an integer `order` column, rewritten in one transaction when
  the dashboard sends a reordered list.
- **`OpeningHours.closeMinutes` may exceed 1440** to express a closing time after
  midnight — 01:00 is stored as 1500. The site's open/closed indicator reads the
  previous day's row to decide whether it is still inside last night's session.
- **Prices** are `Decimal(8,2)`, never floats.
- **`SiteSettings`** is a single row pinned to `id = "singleton"`, upserted on
  read so it always exists.
- **Deletes**: `Media` is `SetNull` on every reference, so removing an image can
  never cascade into losing a menu item. `Category → MenuItem` is `Cascade`, which
  is why the API refuses to delete a non-empty category.
