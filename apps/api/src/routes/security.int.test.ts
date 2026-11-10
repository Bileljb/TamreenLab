// Phase 9 (ADR 013): client IP behind proxies, and the cross-site request guard.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { db, makeApp, resetDatabase } from '../test/harness';

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

const login = { email: 'nobody@example.com', password: 'wrong password' };
const strict = { auth: 1, attempts: 1000, general: 1000, assistant: 1000 };

describe('client IP', () => {
  it('takes the address the trusted proxy appended, not one the client made up', async () => {
    const app = makeApp({ trustProxy: 1, rateLimits: strict });
    const from = (xff: string) =>
      request(app).post('/api/auth/login').set('X-Forwarded-For', xff).send(login);

    expect((await from('9.9.9.9, 198.51.100.1')).status).toBe(401);
    // Same real address, a different invented one in front: still the same client.
    expect((await from('8.8.8.8, 198.51.100.1')).status).toBe(429);
    // Another real address has its own budget.
    expect((await from('198.51.100.2')).status).toBe(401);
  });
});

describe('cross-site requests', () => {
  const app = makeApp();

  it('refuses state changes from another origin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send(login);
    expect([res.status, res.body.error.code]).toEqual([403, 'CROSS_SITE']);

    const fetchMeta = await request(app)
      .post('/api/auth/login')
      .set('Sec-Fetch-Site', 'cross-site')
      .send(login);
    expect(fetchMeta.status).toBe(403);
  });

  it('allows the site itself, non-browser clients and reads', async () => {
    const same = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://tamreen.test')
      .set('Sec-Fetch-Site', 'same-origin')
      .send(login);
    expect(same.status).toBe(401);
    expect((await request(app).post('/api/auth/login').send(login)).status).toBe(401);
    const read = await request(app)
      .get('/api/leaderboard/daily')
      .set('Origin', 'https://evil.example');
    expect(read.status).toBe(200);
  });
});

describe('POST /client-errors', () => {
  const app = makeApp();
  const report = {
    message: 'TypeError: x is undefined',
    stack: 'at LessonPlayer (player.js:1:2)',
    digest: '12345',
    path: '/ar/lessons/aggregation/sum-basics',
  };

  it('accepts a browser error report', async () => {
    expect((await request(app).post('/api/client-errors').send(report)).status).toBe(204);
  });

  it('rejects oversized or unexpected fields, and paths with a query', async () => {
    const send = (body: object) => request(app).post('/api/client-errors').send(body);
    expect((await send({ ...report, message: 'x'.repeat(2000) })).status).toBe(400);
    expect((await send({ ...report, cookie: 'a=b' })).status).toBe(400);
    expect((await send({ ...report, path: '/ar/reset-password?token=secret' })).status).toBe(400);
  });
});
