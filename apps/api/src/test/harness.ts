// Shared setup for integration tests: a real Postgres test database seeded with the real curriculum.
import path from 'node:path';
import { pino } from 'pino';
import request from 'supertest';
import { createApp } from '../app';
import type { AppConfig } from '../config';
import { createPrisma } from '../lib/prisma';
import { syncContent } from '../services/content-sync';

export const TEST_DB_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://tamreen:tamreen@localhost:5432/tamreen_test?schema=public';

export const db = createPrisma(TEST_DB_URL);

/** The test clock. Tests move it to cross day boundaries. */
export const clock = { now: new Date('2026-10-30T09:00:00Z') };

export const config: AppConfig = {
  jwtSecret: 'integration-test-secret-integration-test',
  dayOffsetMinutes: 180,
  includeDrafts: true,
  cookieSecure: false,
  rateLimits: { auth: 1000, attempts: 1000, general: 10_000 },
  now: () => clock.now,
};

export function makeApp(overrides: Partial<AppConfig> = {}) {
  return createApp({
    logger: pino({ level: 'silent' }),
    db,
    config: { ...config, ...overrides },
    checkDb: async () => {
      await db.$queryRaw`SELECT 1`;
    },
  });
}

let seeded = false;

/** Loads the content files once per run (idempotent anyway), and removes every user. */
export async function resetDatabase() {
  if (!seeded) {
    const result = await syncContent(db, path.resolve(import.meta.dirname, '../../../../content'));
    if (result.plan.errors.length) throw new Error(result.plan.errors.join('\n'));
    seeded = true;
  }
  await db.user.deleteMany(); // cascades to attempts, points, progress, streaks and sessions
  clock.now = new Date('2026-10-30T09:00:00Z');
}

let counter = 0;

/** Registers a fresh user and returns a cookie-keeping agent. */
export async function signUp(app = makeApp(), name = 'هدى') {
  const agent = request.agent(app);
  counter++;
  const res = await agent
    .post('/api/auth/register')
    .send({ email: `learner${counter}@example.com`, password: 'correct horse', displayName: name });
  if (res.status !== 201)
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body as { id: string; email: string }, res };
}

/** A cookie's value from a Set-Cookie header list. */
export function cookieValue(setCookie: string[] | string | undefined, name: string) {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const line = list.find((c) => c.startsWith(`${name}=`));
  return line?.split(';')[0]!.slice(name.length + 1);
}
