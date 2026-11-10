// pnpm --filter @tamreen/api load:test — load test of POST /attempts and the daily leaderboard
// (PLAN Phase 9, ADR 013). It uses its own database (`<db>_load` next to DATABASE_URL), seeds it
// at launch-plus scale, starts the real app in this process with test rate limits, and reports
// throughput and latency. Flags: --users=20000 --concurrency=32 --seconds=20 --explain-only
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { loadCurriculum } from '@tamreen/content';
import { pino } from 'pino';
import { createApp } from '../src/app';
import type { AppConfig } from '../src/config';
import { databaseUrlFor } from '../src/lib/backup';
import { dayKey } from '../src/lib/day';
import { createPrisma } from '../src/lib/prisma';
import { accessKey, signAccessToken } from '../src/lib/tokens';
import { syncContent } from '../src/services/content-sync';

const arg = (name: string, fallback: number) =>
  Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const USERS = arg('users', 20_000);
const CONCURRENCY = arg('concurrency', 32);
const SECONDS = arg('seconds', 20);
const EXPLAIN_ONLY = process.argv.includes('--explain-only');

const LIVE = process.env.DATABASE_URL;
if (!LIVE) throw new Error('Set DATABASE_URL');
const dbName = `${new URL(LIVE).pathname.slice(1)}_load`;
const LOAD_URL = `${databaseUrlFor(LIVE, dbName)}?schema=public`;
const CONTENT = path.resolve(import.meta.dirname, '../../../content');
const SECRET = 'load-test-secret-load-test-secret-load';
const DAY_OFFSET = 180;

async function prepareDatabase() {
  const admin = createPrisma(LIVE);
  const exists = await admin.$queryRaw<
    unknown[]
  >`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
  if (exists.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  await admin.$disconnect();
  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  const migrate = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: LOAD_URL },
    stdio: 'ignore',
  });
  if (migrate.status !== 0) throw new Error('prisma migrate deploy failed on the load database');
  const db = createPrisma(LOAD_URL);
  const sync = await syncContent(db, CONTENT);
  if (sync.plan.errors.length) throw new Error(sync.plan.errors.join('\n'));
  return db;
}

/** Users, a month of ledger history, and attempts, written with set-based SQL. */
async function seed(db: ReturnType<typeof createPrisma>, today: string) {
  const have = await db.user.count({ where: { email: { endsWith: '@load.test' } } });
  if (have >= USERS) return;
  console.log(`seeding ${USERS - have} users with history…`);
  await db.$executeRawUnsafe(`
    INSERT INTO "User" (id, email, "passwordHash", "displayName", locale)
    SELECT 'load-' || g, 'learner' || g || '@load.test', 'not-a-hash', 'متعلم ' || g, 'ar'
    FROM generate_series(${have + 1}, ${USERS}) g`);
  // Ten awards per user over the last 30 days; about a sixth of users are active today.
  await db.$executeRawUnsafe(`
    INSERT INTO "PointEvent" (id, "userId", delta, reason, day)
    SELECT 'pe-' || g || '-' || k, 'load-' || g, 100 + (g * k) % 400, 'load:' || k,
           DATE '${today}' - ((g + k) % 30)
    FROM generate_series(${have + 1}, ${USERS}) g, generate_series(1, 10) k`);
  const steps = await db.step.findMany({ select: { id: true }, take: 20 });
  const ids = steps.map((s) => `'${s.id}'`).join(',');
  await db.$executeRawUnsafe(`
    INSERT INTO "Attempt" (id, "userId", "stepId", correct, "firstTry", "timeMs", answer)
    SELECT 'at-' || g || '-' || k, 'load-' || g, (ARRAY[${ids}])[1 + (g + k) % ${steps.length}],
           (g + k) % 3 = 0, k = 1, 20000, '{}'::jsonb
    FROM generate_series(${have + 1}, ${USERS}) g, generate_series(1, 10) k`);
  await db.$executeRawUnsafe('ANALYZE');
}

async function explainLeaderboard(db: ReturnType<typeof createPrisma>, today: string) {
  const plan = await db.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT "userId", SUM(delta) AS points FROM "PointEvent"
    WHERE day = DATE '${today}'
    GROUP BY "userId" HAVING SUM(delta) > 0
    ORDER BY points DESC, "userId" ASC LIMIT 20`);
  console.log(`\nLeaderboard query plan:\n${plan.map((r) => `  ${r['QUERY PLAN']}`).join('\n')}\n`);
}

type Result = { name: string; requests: number; errors: number; latencies: number[] };

/** `CONCURRENCY` clients send requests back to back for `SECONDS` seconds. */
async function run(name: string, request: (i: number) => Promise<Response>): Promise<Result> {
  const result: Result = { name, requests: 0, errors: 0, latencies: [] };
  const end = Date.now() + SECONDS * 1000;
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (Date.now() < end) {
        const started = performance.now();
        const res = await request(i++).catch(() => null);
        result.latencies.push(performance.now() - started);
        result.requests++;
        if (!res || !res.ok) result.errors++;
        await res?.arrayBuffer();
      }
    }),
  );
  return result;
}

function report(r: Result) {
  const sorted = [...r.latencies].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)]!.toFixed(1);
  console.log(
    `${r.name.padEnd(24)} ${String(Math.round(r.requests / SECONDS)).padStart(5)} req/s  ` +
      `p50 ${at(0.5)} ms  p95 ${at(0.95)} ms  p99 ${at(0.99)} ms  errors ${r.errors}/${r.requests}`,
  );
}

const db = await prepareDatabase();
const today = dayKey(new Date(), DAY_OFFSET);
try {
  await seed(db, today);
  await explainLeaderboard(db, today);
  if (!EXPLAIN_ONLY) {
    const config: AppConfig = {
      jwtSecret: SECRET,
      dayOffsetMinutes: DAY_OFFSET,
      includeDrafts: false,
      cookieSecure: false,
      trustProxy: 'loopback',
      rateLimits: { auth: 1e9, attempts: 1e9, general: 1e9, assistant: 1e9 },
      siteUrl: 'http://localhost:3000',
      mailFrom: 'load <load@test>',
      assistant: {
        model: null,
        timeoutMs: 1000,
        userDaily: 0,
        ipDaily: 0,
        dailyTokens: 0,
        monthlyBudgetMicros: 0,
        prices: { input: 0, output: 0 },
      },
      now: () => new Date(),
    };
    const app = createApp({
      logger: pino({ level: 'silent' }),
      db,
      config,
      checkDb: async () => undefined,
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

    // 500 learners, each with a session cookie, answering real formula steps right or wrong.
    const key = accessKey(SECRET);
    const cookies = await Promise.all(
      Array.from(
        { length: 500 },
        async (_, i) => `tamreen_at=${await signAccessToken(`load-${i + 1}`, key)}`,
      ),
    );
    const curriculum = await loadCurriculum(CONTENT);
    const formulaSteps = curriculum.lessons.flatMap((l) =>
      l.steps.flatMap((s) => (s.type === 'ENTER_FORMULA' ? [{ lesson: l.slug, step: s }] : [])),
    );
    const attempt = (i: number) => {
      const { lesson, step } = formulaSteps[i % formulaSteps.length]!;
      return fetch(`${base}/attempts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookies[(i * 7) % cookies.length]! },
        body: JSON.stringify({
          lessonSlug: lesson,
          stepSlug: step.slug,
          answer: { cell: step.check.target, formula: i % 2 ? step.check.solution : '=1' },
          timeMs: 15_000,
        }),
      });
    };
    const leaderboard = () => fetch(`${base}/leaderboard/daily?limit=20`);

    console.log(`${USERS} users, ${CONCURRENCY} concurrent clients, ${SECONDS} s per scenario:`);
    report(await run('POST /attempts', attempt));
    report(await run('GET /leaderboard/daily', leaderboard));
    report(await run('both, mixed 1:1', (i) => (i % 2 ? attempt(i) : leaderboard())));
    server.close();
  }
} finally {
  await db.$disconnect();
}
