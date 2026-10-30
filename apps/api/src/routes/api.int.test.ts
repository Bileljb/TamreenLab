import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { clock, cookieValue, db, makeApp, resetDatabase, signUp } from '../test/harness';

const STEP = { lessonSlug: 'sum-basics', stepSlug: 'sum-function' };
const CORRECT = { cell: 'B7', formula: '=SUM(B2:B6)' };
const attempt = (answer: unknown, extra: Record<string, unknown> = {}) => ({
  ...STEP,
  answer,
  timeMs: 60_000,
  ...extra,
});

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

describe('auth', () => {
  it('registers, sets httpOnly session cookies and returns the user', async () => {
    const { res, agent } = await signUp();
    expect(res.body).toMatchObject({
      email: expect.stringMatching(/@example.com$/),
      displayName: 'هدى',
    });
    expect(res.body.passwordHash).toBeUndefined();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.find((c) => c.startsWith('tamreen_at='))).toMatch(/HttpOnly/);
    expect(cookies.find((c) => c.startsWith('tamreen_rt='))).toMatch(/Path=\/api\/auth/);
    // A readable, non-secret hint so the browser knows a session may exist.
    const hint = cookies.find((c) => c.startsWith('tamreen_session='));
    expect(hint).toMatch(/^tamreen_session=1;/);
    expect(hint).not.toMatch(/HttpOnly/);
    expect((await agent.get('/api/me')).body.displayName).toBe('هدى');
  });

  it('does not count refreshes against the sign-in rate limit', async () => {
    const app = makeApp({ rateLimits: { auth: 1, attempts: 1000, general: 1000 } });
    for (let i = 0; i < 3; i++) {
      expect((await request(app).post('/api/auth/refresh').send({})).status).toBe(401);
    }
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.co', password: 'x' });
    expect(login.status).toBe(401);
  });

  it('rejects a taken email, a blocked name and bad input', async () => {
    const app = makeApp();
    const body = { email: 'same@example.com', password: 'correct horse', displayName: 'سامي' };
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(201);
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ ...body, email: 'SAME@example.com' });
    expect([dup.status, dup.body.error.code]).toEqual([409, 'EMAIL_TAKEN']);
    const blocked = await request(app)
      .post('/api/auth/register')
      .send({ ...body, email: 'x@example.com', displayName: 'Admin' });
    expect(blocked.body.error.code).toBe('DISPLAY_NAME_NOT_ALLOWED');
    const bad = await request(app)
      .post('/api/auth/register')
      .send({ ...body, password: 'short' });
    expect([bad.status, bad.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
  });

  it('logs in with the right password only', async () => {
    const app = makeApp();
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@example.com', password: 'correct horse', displayName: 'ليلى' });
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'nope' });
    expect([wrong.status, wrong.body.error.code]).toEqual([401, 'INVALID_CREDENTIALS']);
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'who@example.com', password: 'x' });
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: ' Login@Example.com', password: 'correct horse' });
    expect(ok.status).toBe(200);
  });

  it('rotates refresh tokens and revokes the family when an old one is reused', async () => {
    const app = makeApp();
    const { res } = await signUp(app);
    const first = cookieValue(res.headers['set-cookie'], 'tamreen_rt')!;

    const rotated = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `tamreen_rt=${first}`)
      .send({});
    expect(rotated.status).toBe(200);
    const second = cookieValue(rotated.headers['set-cookie'], 'tamreen_rt')!;
    expect(second).not.toBe(first);

    const reused = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `tamreen_rt=${first}`)
      .send({});
    expect([reused.status, reused.body.error.code]).toEqual([401, 'REFRESH_REUSED']);
    // The leak revoked the whole family, so the newer token is dead too.
    const after = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `tamreen_rt=${second}`)
      .send({});
    expect(after.status).toBe(401);
  });

  it('expires access tokens after 15 minutes and refresh tokens after 30 days', async () => {
    const app = makeApp();
    const { agent, res } = await signUp(app);
    clock.now = new Date(clock.now.getTime() + 16 * 60_000);
    expect((await agent.get('/api/me')).status).toBe(401);
    clock.now = new Date(clock.now.getTime() + 31 * 86_400_000);
    const rt = cookieValue(res.headers['set-cookie'], 'tamreen_rt')!;
    const expired = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `tamreen_rt=${rt}`)
      .send({});
    expect(expired.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('logs out: the refresh token stops working', async () => {
    const app = makeApp();
    const { res } = await signUp(app);
    const rt = cookieValue(res.headers['set-cookie'], 'tamreen_rt')!;
    const out = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `tamreen_rt=${rt}`)
      .send({});
    expect(out.status).toBe(204);
    expect(out.headers['set-cookie']?.[0]).toMatch(/tamreen_at=;/);
    const again = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `tamreen_rt=${rt}`)
      .send({});
    expect(again.status).toBe(401);
    const none = await request(app).post('/api/auth/refresh').send({});
    expect(none.body.error.code).toBe('NO_SESSION');
  });

  it('requires JSON for state-changing requests (CSRF guard)', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .type('form')
      .send('email=a@b.co&password=x');
    expect([res.status, res.body.error.code]).toEqual([415, 'UNSUPPORTED_MEDIA_TYPE']);
  });

  it('rate-limits sign-in attempts', async () => {
    const app = makeApp({ rateLimits: { auth: 2, attempts: 1000, general: 1000 } });
    const login = () =>
      request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' });
    await login();
    await login();
    const third = await login();
    expect([third.status, third.body.error.code]).toEqual([429, 'RATE_LIMITED']);
  });
});

describe('content', () => {
  it('lists tracks and lessons and serves a lesson with its steps', async () => {
    const app = makeApp();
    const tracks = await request(app).get('/api/tracks');
    expect(tracks.body[0]).toMatchObject({ slug: 'basics', lessonCount: 3 });
    const lessons = await request(app).get('/api/lessons?track=aggregation');
    expect(lessons.body.map((l: { slug: string }) => l.slug)).toContain('sum-basics');
    const lesson = await request(app).get('/api/lessons/sum-basics');
    expect(lesson.body.steps).toHaveLength(6);
    expect(lesson.body.steps[1]).toMatchObject({ slug: 'sum-function', type: 'ENTER_FORMULA' });
    expect((await request(app).get('/api/lessons/nope')).status).toBe(404);
  });

  it('hides draft lessons when drafts are off', async () => {
    const app = makeApp({ includeDrafts: false });
    expect((await request(app).get('/api/lessons')).body).toEqual([]);
    expect((await request(app).get('/api/lessons/sum-basics')).status).toBe(404);
  });
});

describe('POST /attempts', () => {
  it('requires a signed-in user', async () => {
    const res = await request(makeApp()).post('/api/attempts').send(attempt(CORRECT));
    expect([res.status, res.body.error.code]).toEqual([401, 'UNAUTHENTICATED']);
  });

  it('checks on the server and awards points once', async () => {
    const { agent } = await signUp();
    const wrong = await agent.post('/api/attempts').send(attempt({ cell: 'B7', formula: '=420' }));
    expect(wrong.body).toEqual({
      correct: false,
      code: 'HARDCODED_VALUE',
      pointsAwarded: 0,
      firstTry: true,
    });

    const right = await agent.post('/api/attempts').send(attempt(CORRECT, { timeMs: 5_000 }));
    // Not first try: base 300 + full speed bonus 150.
    expect(right.body).toEqual({ correct: true, code: 'OK', pointsAwarded: 450, firstTry: false });

    // Resubmitting the same correct step awards nothing more.
    const again = await agent.post('/api/attempts').send(attempt(CORRECT, { timeMs: 1 }));
    expect(again.body).toMatchObject({ correct: true, pointsAwarded: 0 });
    expect(await db.pointEvent.count()).toBe(1);
  });

  it('ignores a forged "correct" claim from the client', async () => {
    const { agent } = await signUp();
    const forged = await agent
      .post('/api/attempts')
      .send({ ...attempt({ cell: 'B7', formula: '=1' }), correct: true, pointsAwarded: 9999 });
    expect([forged.status, forged.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
    const wrongButClaimed = await agent
      .post('/api/attempts')
      .send(attempt({ cell: 'A1', formula: '=1' }));
    expect(wrongButClaimed.body).toMatchObject({ correct: false, pointsAwarded: 0 });
    expect(await db.pointEvent.count()).toBe(0);
  });

  it('applies hint and Show Answer to the score', async () => {
    const { agent } = await signUp();
    const hinted = await agent.post('/api/attempts').send(attempt(CORRECT, { hintUsed: true }));
    expect(hinted.body.pointsAwarded).toBe(188); // (300 + 75 first try) / 2
    const other = { lessonSlug: 'sum-basics', stepSlug: 'first-formula' };
    const shown = await agent.post('/api/attempts').send({
      ...other,
      answer: { cell: 'B7', formula: '=B2+B3+B4+B5+B6' },
      timeMs: 1,
      answerShown: true,
    });
    expect(shown.body).toMatchObject({ correct: true, pointsAwarded: 0 });
  });

  it('rejects unknown steps and answers of the wrong shape', async () => {
    const { agent } = await signUp();
    const missing = await agent
      .post('/api/attempts')
      .send({ ...attempt(CORRECT), stepSlug: 'nope' });
    expect([missing.status, missing.body.error.code]).toEqual([404, 'STEP_NOT_FOUND']);
    const shape = await agent.post('/api/attempts').send(attempt({ choice: 1 }));
    expect([shape.status, shape.body.error.code]).toEqual([400, 'INVALID_ANSWER']);
  });

  it('pays each step once even under concurrent submissions', async () => {
    const { agent } = await signUp();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => agent.post('/api/attempts').send(attempt(CORRECT))),
    );
    const paid = results.map((r) => r.body.pointsAwarded).filter((p: number) => p > 0);
    expect(paid).toHaveLength(1);
    expect(await db.pointEvent.count()).toBe(1);
  });
});

describe('progress, stats and streaks', () => {
  const solveLesson = async (agent: ReturnType<typeof request.agent>) => {
    const lesson = (await agent.get('/api/lessons/cells-and-selection')).body as {
      steps: { slug: string; type: string; check: Record<string, unknown> }[];
    };
    for (const step of lesson.steps) {
      const c = step.check as { target?: string; expected?: unknown; correct?: number };
      const answer =
        step.type === 'SELECT_CELL'
          ? { cell: c.target }
          : step.type === 'SELECT_RANGE'
            ? { range: c.target }
            : step.type === 'ENTER_VALUE'
              ? { cell: c.target, value: String(c.expected) }
              : { choice: c.correct };
      const res = await agent
        .post('/api/attempts')
        .send({ lessonSlug: 'cells-and-selection', stepSlug: step.slug, answer, timeMs: 20_000 });
      expect(res.body.correct, step.slug).toBe(true);
    }
  };

  it('tracks lesson progress, completion and stats', async () => {
    const { agent } = await signUp();
    await solveLesson(agent);
    const progress = await agent.get('/api/me/progress');
    expect(progress.body[0]).toMatchObject({
      lessonSlug: 'cells-and-selection',
      totalSteps: 6,
      firstTryRate: 1,
    });
    expect(progress.body[0].stepsDone).toHaveLength(6);
    expect(progress.body[0].completedAt).toBeTruthy();
    const stats = await agent.get('/api/me/stats');
    expect(stats.body).toMatchObject({
      lessonsCompleted: 1,
      firstTryAccuracy: 1,
      streak: { current: 1, longest: 1 },
    });
    expect(stats.body.pointsToday).toBe(stats.body.pointsTotal);
    expect(stats.body.pointsTotal).toBeGreaterThan(0);
  });

  it('counts consecutive days in the streak and resets after a gap', async () => {
    const { agent } = await signUp();
    await agent.post('/api/attempts').send(attempt(CORRECT));
    clock.now = new Date('2026-10-31T09:00:00Z');
    // The 15-minute access token has expired by now; a real client refreshes, so do the same.
    expect((await agent.post('/api/auth/refresh').send({})).status).toBe(200);
    await agent
      .post('/api/attempts')
      .send({ ...attempt({ cell: 'B7', formula: '=B2+B3+B4+B5+B6' }), stepSlug: 'first-formula' });
    expect((await agent.get('/api/me/stats')).body.streak).toEqual({ current: 2, longest: 2 });
    clock.now = new Date('2026-11-03T09:00:00Z');
    expect((await agent.post('/api/auth/refresh').send({})).status).toBe(200);
    const stats = (await agent.get('/api/me/stats')).body;
    expect(stats.streak).toEqual({ current: 0, longest: 2 });
    expect(stats.pointsToday).toBe(0);
  });
});

describe('POST /progress/sync', () => {
  const guestProgress = {
    version: 1,
    lessons: {
      'sum-basics': {
        stepsDone: ['first-formula', 'sum-function', 'not-a-step'],
        firstTry: ['first-formula'],
        points: 99999,
      },
      'no-such-lesson': { stepsDone: ['x'], firstTry: [], points: 5 },
    },
  };

  it('merges guest progress once, with flat base points', async () => {
    const { agent } = await signUp();
    const first = await agent.post('/api/progress/sync').send({ guestProgress });
    expect(first.body).toEqual({ mergedSteps: 2, pointsAwarded: 600 });
    const second = await agent.post('/api/progress/sync').send({ guestProgress });
    expect(second.body).toEqual({ mergedSteps: 0, pointsAwarded: 0 });
    const progress = (await agent.get('/api/me/progress')).body;
    expect(progress[0].stepsDone.sort()).toEqual(['first-formula', 'sum-function']);
  });

  it('skips steps already earned through attempts', async () => {
    const { agent } = await signUp();
    await agent.post('/api/attempts').send(attempt(CORRECT));
    const res = await agent.post('/api/progress/sync').send({ guestProgress });
    expect(res.body).toEqual({ mergedSteps: 1, pointsAwarded: 300 });
  });

  it('caps one merge at 3000 points', async () => {
    const { agent } = await signUp();
    const lessons = (await agent.get('/api/lessons')).body as { slug: string }[];
    const all: Record<string, { stepsDone: string[]; firstTry: string[]; points: number }> = {};
    for (const l of lessons) {
      const steps = (await agent.get(`/api/lessons/${l.slug}`)).body.steps as { slug: string }[];
      all[l.slug] = { stepsDone: steps.map((s) => s.slug), firstTry: [], points: 0 };
    }
    const res = await agent
      .post('/api/progress/sync')
      .send({ guestProgress: { version: 1, lessons: all } });
    expect(res.body.pointsAwarded).toBe(3000);
    expect(res.body.mergedSteps).toBeGreaterThan(10);
  });

  it('requires a user', async () => {
    const res = await request(makeApp()).post('/api/progress/sync').send({ guestProgress });
    expect(res.status).toBe(401);
  });
});

describe('leaderboard and account deletion', () => {
  it("ranks today's points and marks the caller", async () => {
    const app = makeApp();
    const a = await signUp(app, 'سلمى');
    const b = await signUp(app, 'يوسف');
    await a.agent.post('/api/attempts').send(attempt(CORRECT, { timeMs: 60_000 }));
    await b.agent.post('/api/attempts').send(attempt(CORRECT, { timeMs: 1 }));
    const board = await b.agent.get('/api/leaderboard/daily?limit=5');
    expect(board.body.entries).toEqual([
      { rank: 1, displayName: 'يوسف', points: 525, isMe: true },
      { rank: 2, displayName: 'سلمى', points: 375, isMe: false },
    ]);
    const anon = await request(app).get('/api/leaderboard/daily');
    expect(anon.body.entries.every((e: { isMe: boolean }) => !e.isMe)).toBe(true);
    clock.now = new Date('2026-11-01T09:00:00Z');
    expect((await request(app).get('/api/leaderboard/daily')).body.entries).toEqual([]);
    expect((await request(app).get('/api/leaderboard/daily?limit=500')).status).toBe(400);
  });

  it('deletes the account and everything it owns', async () => {
    const { agent, user } = await signUp();
    await agent.post('/api/attempts').send(attempt(CORRECT));
    const del = await agent.delete('/api/me');
    expect(del.status).toBe(204);
    expect(await db.user.count({ where: { id: user.id } })).toBe(0);
    expect(await db.pointEvent.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.attempt.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.refreshToken.count({ where: { userId: user.id } })).toBe(0);
    expect((await agent.get('/api/me')).status).toBe(401);
  });
});

describe('GET /docs', () => {
  it('serves an OpenAPI document generated from the zod schemas', async () => {
    const res = await request(makeApp()).get('/api/docs');
    expect(res.body.openapi).toBe('3.1.0');
    const attempts = res.body.paths['/api/attempts'].post;
    expect(Object.keys(attempts.requestBody.content['application/json'].schema.properties)).toEqual(
      ['lessonSlug', 'stepSlug', 'answer', 'timeMs', 'hintUsed', 'answerShown'],
    );
  });
});

describe('POST /events', () => {
  const event = {
    name: 'lesson_start',
    anonId: 'anon-12345678',
    sessionId: 'session-1234',
    lessonSlug: 'sum-basics',
  };

  it('stores an anonymous event with the day and nothing about the person', async () => {
    const res = await request(makeApp()).post('/api/events').send(event);
    expect(res.status).toBe(204);
    const rows = await db.analyticsEvent.findMany({ where: { anonId: 'anon-12345678' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'lesson_start',
      lessonSlug: 'sum-basics',
      stepSlug: null,
    });
    expect(rows[0]!.day.toISOString().slice(0, 10)).toBe('2026-10-30');
    expect(Object.keys(rows[0]!)).not.toContain('userId');
    await db.analyticsEvent.deleteMany({ where: { anonId: 'anon-12345678' } });
  });

  it('rejects unknown events and extra fields', async () => {
    const app = makeApp();
    expect(
      (
        await request(app)
          .post('/api/events')
          .send({ ...event, name: 'clicked' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/events')
          .send({ ...event, email: 'a@b.co' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/events')
          .send({ ...event, anonId: 'x' })
      ).status,
    ).toBe(400);
  });
});
