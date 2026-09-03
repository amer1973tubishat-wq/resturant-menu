# Security test scripts

Plain Node scripts — no test framework — that exercise the running server the
way a client does: real HTTP, real cookies, real CSRF tokens.

Start the app first (`npm run dev` or `npm start`), then:

```bash
node tests/authtest.mjs '<the seeded password>'   # login, CSRF, forced change, audit, logout
node tests/sectest.mjs                            # RBAC, 2FA, backup codes, lockout
node tests/locktest.mjs                           # lockout in isolation
```

`authtest.mjs` changes the admin password to `Amman-Grill-2026!x`, which the
other two then expect. They are destructive by design — run them against a
development database, never production.

Between runs, reset the account state with:

```sql
UPDATE "User" SET "twoFactorEnabled"=false, "twoFactorSecret"=NULL,
                  "failedAttempts"=0, "lockedUntil"=NULL;
```
