# API reference

Base URL: `http://localhost:3001` in development.

## Conventions

- **Auth** — a short-lived access JWT in the `baytna_at` cookie (httpOnly, Secure,
  SameSite=Strict). Expired tokens are renewed via `POST /api/auth/refresh` using
  the `baytna_rt` refresh cookie, which rotates on every use.
- **CSRF** — every `POST`/`PUT`/`PATCH`/`DELETE` must echo the value of the
  readable `baytna_csrf` cookie in an `x-csrf-token` header.
- **Errors** — `{ "error": string, "code"?: string, "issues"?: [...] }`.
- **Permissions** — each route names the permission it needs; the role table is
  at the bottom.

### Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | No valid session |
| `INVALID_CREDENTIALS` | 401 | Wrong username or password (identical response for both) |
| `ACCOUNT_LOCKED` | 423 | Too many failed attempts; retry after the stated delay |
| `ACCOUNT_DISABLED` | 403 | Account deactivated by an admin |
| `TWO_FACTOR_REQUIRED` | 403 | Session is pending 2FA verification |
| `PASSWORD_CHANGE_REQUIRED` | 403 | Forced password change not yet completed |
| `CSRF_FAILED` | 403 | Missing or invalid CSRF token |
| `FORBIDDEN` | 403 | Role lacks the required permission |
| `RATE_LIMITED` | 429 | Too many requests; see `Retry-After` |
| `WEAK_PASSWORD` | 422 | Fails the policy, or found in a breach corpus |
| `VALIDATION` | 422 | Body failed schema validation; see `issues` |

---

## Authentication

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | public | `{ identifier, password, rememberMe? }` → `{ twoFactorRequired, mustChangePassword }` |
| POST | `/api/auth/logout` | session | Revokes the session and clears cookies |
| POST | `/api/auth/refresh` | refresh cookie | Rotates the token. Replaying a used token revokes **all** that user's sessions |
| GET | `/api/auth/me` | session | Current user plus their permission list |
| GET | `/api/auth/sessions` | session | Active sessions for the current user |
| DELETE | `/api/auth/sessions` | session | Sign out of every device |

### Password

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/password/change` | session | `{ currentPassword, newPassword, confirmPassword }`. Reachable while a forced change is pending. Revokes other sessions |
| POST | `/api/auth/password/forgot` | public | `{ email }`. Identical response whether or not the address exists |
| POST | `/api/auth/password/reset` | public | `{ token, newPassword, confirmPassword }`. Single use, expires in 15 minutes |

### Two-factor

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/2fa/setup` | session | `{ secret, otpauthUrl, qr }`. Does **not** enable 2FA yet |
| POST | `/api/auth/2fa/enable` | session | `{ code }`. Confirms the app works, then returns 10 backup codes **once** |
| POST | `/api/auth/2fa/verify` | pending session | `{ code }` — a TOTP or a backup code. The only route reachable while 2FA is pending |
| POST | `/api/auth/2fa/disable` | session | `{ currentPassword }` |

---

## Menu

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/menu/categories` | `menu:read` |
| POST | `/api/menu/categories` | `menu:write` |
| PATCH, DELETE | `/api/menu/categories/{id}` | `menu:write` |
| GET | `/api/menu/items?q&categoryId&page&perPage&published` | `menu:read` |
| POST | `/api/menu/items` | `menu:write` |
| GET, PATCH, DELETE | `/api/menu/items/{id}` | `menu:read` / `menu:write` |
| POST | `/api/menu/reorder` | `menu:write` — `{ type: 'category'\|'item', ids }`, applied in one transaction |
| POST | `/api/menu/bulk` | `menu:write` — `{ ids, action }` where action is `delete`, `publish`, `unpublish`, `available`, `unavailable` or `duplicate` |

Deleting a category that still has items returns `409 CATEGORY_NOT_EMPTY`.

## Media

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/media?q&page&perPage` | `media:read` |
| POST | `/api/media` | `media:write` — multipart `files`, max 20 per request |
| DELETE | `/api/media/{id}` | `media:delete` — `409 MEDIA_IN_USE` if referenced anywhere |

Uploads are type-checked by magic bytes, re-encoded to WebP at three sizes, and
written under a random filename.

## Content

| Method | Path | Permission |
| --- | --- | --- |
| GET, POST | `/api/hero` | `content:read` / `content:write` |
| PATCH, DELETE | `/api/hero/{id}` | `content:write` |
| GET, PUT | `/api/content/story` | `content:read` / `content:write` |
| GET, PUT | `/api/content/hours` | `content:read` / `content:write` |
| GET, POST | `/api/builder/steps` | `menu:read` / `menu:write` |
| POST | `/api/builder/options` | `menu:write` |
| PATCH, DELETE | `/api/builder/options/{id}` | `menu:write` |

## Inbox, users, audit, settings

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/messages?status&page` | `messages:read` |
| PATCH, DELETE | `/api/messages/{id}` | `messages:write` |
| GET, POST | `/api/users` | `users:read` / `users:write` |
| PATCH, DELETE | `/api/users/{id}` | `users:write` |
| POST | `/api/users/{id}` | `users:write` — resets that user's password |
| GET | `/api/audit?q&entity&action&userId&from&to&page` | `audit:read` |
| GET, PATCH | `/api/settings` | `settings:read` / `settings:write` |
| GET | `/api/stats` | `menu:read` |
| GET, POST | `/api/backup` | `backup:run` |

---

## Public endpoints

Read-only, unauthenticated, CORS restricted to `PUBLIC_SITE_URL`. This is the
contract the marketing site consumes.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/public/menu` | Visible categories with their published items |
| GET | `/api/public/site` | Settings, hours, hero slides, story, socials, live promotions, builder |
| POST | `/api/public/view` | Analytics beacon — `{ path, itemId? }`; the IP is stored hashed |
| POST | `/api/public/contact` | `{ name, email?, phone?, body, type? }`, with a honeypot field |

Promotions appear and disappear on their own `startsAt`/`endsAt` dates with no
manual step.

---

## Roles

| Permission | Viewer | Editor | Admin | Super Admin |
| --- | :-: | :-: | :-: | :-: |
| `menu:read`, `content:read`, `media:read`, `messages:read`, `settings:read` | yes | yes | yes | yes |
| `menu:write`, `media:write` | | yes | yes | yes |
| `content:write`, `media:delete`, `messages:write`, `settings:write`, `audit:read` | | | yes | yes |
| `users:read`, `users:write`, `backup:run` | | | | yes |
