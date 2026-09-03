import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { json, withAuth, fail } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { env } from '@/lib/env';

const run = promisify(execFile);
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

export const GET = withAuth({ permission: 'backup:run' }, async () => {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const files = await fs.readdir(BACKUP_DIR);
  const backups = await Promise.all(
    files.filter((f) => f.endsWith('.sql')).map(async (f) => {
      const s = await fs.stat(path.join(BACKUP_DIR, f));
      return { name: f, size: s.size, createdAt: s.mtime };
    }),
  );
  backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return json({ backups });
});

/**
 * Shells out to pg_dump with the URL passed as an argument, never through a
 * shell string, so nothing in DATABASE_URL can be interpreted as a command.
 */
export const POST = withAuth({ permission: 'backup:run' }, async ({ user, ip, userAgent }) => {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const name = `baytna-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
  const target = path.join(BACKUP_DIR, name);

  try {
    await run('pg_dump', ['--no-owner', '--no-privileges', '--file', target, env.DATABASE_URL], {
      timeout: 120_000,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    console.error('[backup] pg_dump failed', err);
    return fail('Backup failed. Check that pg_dump is installed and reachable.', 500, 'BACKUP_FAILED');
  }

  const stat = await fs.stat(target);
  await writeAudit({
    actor: user, action: 'BACKUP_CREATED', entity: 'Database',
    summary: `${name} (${Math.round(stat.size / 1024)} KB)`, ip, userAgent,
  });
  return json({ ok: true, backup: { name, size: stat.size, createdAt: stat.mtime } }, 201);
});
