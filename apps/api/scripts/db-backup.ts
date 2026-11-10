// pnpm db:backup — a compressed dump of DATABASE_URL plus a manifest of row counts (ADR 013).
// pnpm db:restore-drill [file] — restores the newest (or given) dump into a scratch database,
// checks it against the manifest, and drops the scratch database. It never touches the live one.
//
// pg_dump and pg_restore come from PATH; without them, from the local Docker database
// (`docker compose exec db`). BACKUP_DIR sets the folder (default: backups/ at the repo root).
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { createPrisma } from '../src/lib/prisma';
import {
  backupFileName,
  compareManifest,
  databaseUrlFor,
  insideContainer,
  type BackupManifest,
} from '../src/lib/backup';

const REPO = path.resolve(import.meta.dirname, '../../..');
const DIR = path.resolve(process.env.BACKUP_DIR ?? path.join(REPO, 'backups'));
const LIVE = process.env.DATABASE_URL;
if (!LIVE) throw new Error('Set DATABASE_URL');

const viaDocker = spawnSync('pg_dump', ['--version']).error !== undefined;

/** Runs pg_dump or pg_restore, piping stdin/stdout, and fails on a non-zero exit. */
function pgTool(tool: string, args: string[], io: { stdin?: Readable; stdout?: Writable }) {
  const [cmd, argv] = viaDocker
    ? ['docker', ['compose', 'exec', '-T', process.env.PG_DOCKER_SERVICE ?? 'db', tool, ...args]]
    : [tool, args];
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, argv, { cwd: REPO, stdio: ['pipe', 'pipe', 'inherit'] });
    if (io.stdin) io.stdin.pipe(child.stdin);
    else child.stdin.end();
    if (io.stdout) child.stdout.pipe(io.stdout);
    else child.stdout.resume();
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${tool} exited with ${code}`)),
    );
  });
}

const urlForTool = (url: string) =>
  viaDocker ? insideContainer(url) : databaseUrlFor(url, new URL(url).pathname.slice(1));

type Db = ReturnType<typeof createPrisma>;
type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0];

async function snapshotOf(db: Db | Tx): Promise<Omit<BackupManifest, 'createdAt'>> {
  const tables = await db.$queryRaw<{ name: string }[]>`
    SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
    ORDER BY table_name`;
  const counts: Record<string, number> = {};
  for (const { name } of tables) {
    const [row] = await db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "${name.replace(/"/g, '""')}"`,
    );
    counts[name] = Number(row!.n);
  }
  const [last] = await db.$queryRaw<{ name: string }[]>`
    SELECT migration_name AS name FROM _prisma_migrations
    WHERE finished_at IS NOT NULL ORDER BY migration_name DESC LIMIT 1`;
  return { tables: counts, migration: last?.name ?? null };
}

async function backup() {
  await mkdir(DIR, { recursive: true });
  const createdAt = new Date();
  const file = path.join(DIR, backupFileName(createdAt));
  const db = createPrisma(LIVE);
  try {
    // Count and dump the same snapshot, so the manifest matches the dump exactly.
    const manifest = await db.$transaction(
      async (tx) => {
        const [snapshot] = await tx.$queryRaw<{ id: string }[]>`SELECT pg_export_snapshot() AS id`;
        const id = snapshot!.id;
        const counted = await snapshotOf(tx);
        await pgTool(
          'pg_dump',
          [
            '--format=custom',
            '--no-owner',
            '--no-privileges',
            `--snapshot=${id}`,
            '--dbname',
            urlForTool(LIVE!),
          ],
          { stdout: createWriteStream(file) },
        );
        return { createdAt: createdAt.toISOString(), ...counted };
      },
      { isolationLevel: 'RepeatableRead', timeout: 30 * 60_000, maxWait: 10_000 },
    );
    await writeFile(`${file}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
    const rows = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
    console.log(
      `backup: ${file} (${Object.keys(manifest.tables).length} tables, ${rows} rows, ${manifest.migration})`,
    );
  } finally {
    await db.$disconnect();
  }
}

async function restoreDrill(given?: string) {
  const file =
    given ??
    path.join(
      DIR,
      (await readdir(DIR))
        .filter((f) => f.endsWith('.dump'))
        .sort()
        .at(-1) ?? '',
    );
  if (!file.endsWith('.dump')) throw new Error(`No backup found in ${DIR}`);
  const manifest = JSON.parse(await readFile(`${file}.json`, 'utf8')) as BackupManifest;
  const scratchName = `${new URL(LIVE!).pathname.slice(1)}_restore_drill`;
  const scratch = databaseUrlFor(LIVE!, scratchName);
  const admin = createPrisma(LIVE);
  const started = Date.now();
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${scratchName}"`);
    await pgTool(
      'pg_restore',
      ['--no-owner', '--no-privileges', '--exit-on-error', '--dbname', urlForTool(scratch)],
      { stdin: createReadStream(file) },
    );
    const restoredDb = createPrisma(scratch);
    let restored;
    try {
      restored = await snapshotOf(restoredDb);
    } finally {
      await restoredDb.$disconnect();
    }
    const problems = compareManifest(manifest, restored.tables, restored.migration);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (problems.length) {
      console.error(`restore drill FAILED for ${path.basename(file)}:\n  ${problems.join('\n  ')}`);
      process.exitCode = 1;
    } else {
      const rows = Object.values(restored.tables).reduce((a, b) => a + b, 0);
      console.log(
        `restore drill OK: ${path.basename(file)} → ${scratchName} in ${seconds}s; ` +
          `${Object.keys(restored.tables).length} tables and ${rows} rows match the manifest; migration ${restored.migration}`,
      );
    }
  } finally {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`);
    await admin.$disconnect();
  }
}

const [command, arg] = process.argv.slice(2);
if (command === 'backup') await backup();
else if (command === 'restore-drill') await restoreDrill(arg);
else throw new Error('Usage: db-backup.ts backup | restore-drill [file]');
