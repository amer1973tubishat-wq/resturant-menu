/**
 * Puts the admin account back into the state a fresh seed produces, so the
 * suites can be run repeatedly. Development only.
 */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const db = new PrismaClient();
const START_PASSWORD = process.argv[2] ?? 'Seed-Start-Pass-2026!';

await db.user.deleteMany({ where: { username: { in: ['editor1'] } } });
await db.user.updateMany({
  where: { username: 'admin' },
  data: {
    passwordHash: await hash(START_PASSWORD, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    mustChangePassword: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    failedAttempts: 0,
    lockedUntil: null,
  },
});
await db.backupCode.deleteMany({});
await db.session.deleteMany({});
console.log(`admin reset — password is now: ${START_PASSWORD}`);
await db.$disconnect();
