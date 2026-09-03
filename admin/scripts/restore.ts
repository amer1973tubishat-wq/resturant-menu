/**
 * Restores a pg_dump file created by `npm run db:backup` or the Settings page.
 *
 * Deliberately a CLI command rather than a dashboard button: restoring
 * overwrites live data, so it should require shell access, not a click.
 *
 *   npm run db:restore -- backups/baytna-2026-01-01T00-00-00-000Z.sql
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

const run = promisify(execFile);

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npm run db:restore -- <path-to-backup.sql>');
    process.exit(1);
  }
  const target = path.resolve(file);
  if (!fs.existsSync(target)) {
    console.error(`No such file: ${target}`);
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Load your .env first.');
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `This REPLACES the contents of the database at\n  ${url.replace(/:[^:@]+@/, ':****@')}\nwith\n  ${target}\n\nType "restore" to continue: `,
  );
  rl.close();
  if (answer.trim() !== 'restore') {
    console.log('Aborted.');
    process.exit(0);
  }

  // psql is given the URL as an argument, never interpolated into a shell string.
  await run('psql', ['--set', 'ON_ERROR_STOP=on', '--file', target, url], {
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  console.log('Restore complete.');
}

main().catch((err) => {
  console.error('Restore failed:', err.message ?? err);
  process.exit(1);
});
