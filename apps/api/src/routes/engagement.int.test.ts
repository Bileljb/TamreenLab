// Phase 7 (ADR 011): settings, levels and daily goal, streak freeze, review queue, reminders.
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { CONTENT_LOCALES, type ContentLocale, type EmailCopy } from '@tamreen/shared';
import { loadEmailCopy } from '@tamreen/content';
import { createContext } from '../context';
import { LogMailer } from '../lib/mailer';
import { sendWeeklyReminders } from '../services/reminders';
import { clock, config, db, makeApp, resetDatabase, signUp } from '../test/harness';

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

const STEP = { lessonSlug: 'sum-basics', stepSlug: 'sum-function', timeMs: 20_000 };
const RIGHT = { cell: 'B7', formula: '=SUM(B2:B6)' };
const WRONG = { cell: 'B7', formula: '=420' };
const OTHER = {
  lessonSlug: 'sum-basics',
  stepSlug: 'first-formula',
  timeMs: 20_000,
  answer: { cell: 'B7', formula: '=B2+B3+B4+B5+B6' },
};

type Agent = ReturnType<typeof request.agent>;

/** Moves the test clock and refreshes the 15-minute session, as a real client would. */
async function travel(agent: Agent, iso: string) {
  clock.now = new Date(iso);
  expect((await agent.post('/api/auth/refresh').send({})).status).toBe(200);
}

describe('settings', () => {
  it('starts with no emails, the default goal and no freeze', async () => {
    const { res } = await signUp();
    expect(res.body.settings).toEqual({ dailyGoal: 900, streakFreeze: false, emailOptIn: false });
    const user = await db.user.findFirstOrThrow({ where: { email: res.body.email } });
    expect(user.emailOptInAt).toBeNull();
  });

  it('opts in at sign-up only when asked, and records when', async () => {
    const res = await request(makeApp()).post('/api/auth/register').send({
      email: 'optin@example.com',
      password: 'correct horse',
      displayName: 'منى',
      emailOptIn: true,
      locale: 'fr',
    });
    expect(res.body.settings.emailOptIn).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { email: 'optin@example.com' } });
    expect(user).toMatchObject({ locale: 'fr', emailOptIn: true });
    expect(user.emailOptInAt).toEqual(clock.now);
  });

  it('changes the goal, the freeze and reminders, and rejects other values', async () => {
    const { agent } = await signUp();
    const res = await agent
      .patch('/api/me/settings')
      .send({ dailyGoal: 1800, streakFreeze: true, emailOptIn: true, locale: 'en' });
    expect(res.body.settings).toEqual({ dailyGoal: 1800, streakFreeze: true, emailOptIn: true });
    expect((await agent.get('/api/me')).body.settings.streakFreeze).toBe(true);

    const off = await agent.patch('/api/me/settings').send({ emailOptIn: false });
    expect(off.body.settings).toMatchObject({ dailyGoal: 1800, emailOptIn: false });

    for (const bad of [{ dailyGoal: 500 }, { emailOptIn: 'yes' }, { role: 'ADMIN' }]) {
      const r = await agent.patch('/api/me/settings').send(bad);
      expect([r.status, r.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
    }
  });
});

describe('stats for a returning learner', () => {
  it('reports the level, the goal, reviews due and where to continue', async () => {
    const { agent } = await signUp();
    let stats = (await agent.get('/api/me/stats')).body;
    expect(stats).toMatchObject({
      level: { level: 1, into: 0, span: 500 },
      dailyGoal: 900,
      reviewsDue: 0,
      nextLesson: { slug: 'cells-and-selection', track: 'basics' },
    });

    await agent.post('/api/attempts').send({ ...STEP, answer: WRONG });
    await agent.post('/api/attempts').send({ ...STEP, answer: RIGHT });
    stats = (await agent.get('/api/me/stats')).body;
    expect(stats.reviewsDue).toBe(1);
    // A started lesson comes before the first untouched one.
    expect(stats.nextLesson).toEqual({ slug: 'sum-basics', track: 'aggregation' });
    expect(stats.level.level).toBe(1);
    expect(stats.level.into).toBe(stats.pointsTotal);
  });
});

describe('review mistakes', () => {
  it('queues a missed step and spaces it out until it graduates', async () => {
    const { agent } = await signUp();
    await agent.post('/api/attempts').send({ ...STEP, answer: WRONG });
    const queue = (await agent.get('/api/me/review')).body;
    expect(queue.items).toEqual([
      { lessonSlug: 'sum-basics', stepSlug: 'sum-function', track: 'aggregation', box: 0 },
    ]);

    // A correct answer in the lesson does not count as a review.
    const inLesson = await agent.post('/api/attempts').send({ ...STEP, answer: RIGHT });
    expect(inLesson.body.pointsAwarded).toBeGreaterThan(0);
    expect((await agent.get('/api/me/review')).body.items).toHaveLength(1);

    const review = () =>
      agent.post('/api/attempts').send({ ...STEP, answer: RIGHT, mode: 'review' });
    expect((await review()).body).toMatchObject({ correct: true, pointsAwarded: 50 });
    expect((await agent.get('/api/me/review')).body.items).toEqual([]);
    // Reviewing again the same day pays nothing: it is not due.
    expect((await review()).body.pointsAwarded).toBe(0);

    for (const [day, box] of [
      ['2026-10-31T09:00:00Z', 1],
      ['2026-11-03T09:00:00Z', 2],
      ['2026-11-10T09:00:00Z', 3],
    ] as const) {
      await travel(agent, day);
      expect((await agent.get('/api/me/review')).body.items[0]?.box).toBe(box);
      expect((await review()).body.pointsAwarded).toBe(50);
    }
    expect(await db.reviewItem.count()).toBe(0);
  });

  it('starts over after a wrong review, and pays nothing when the answer was shown', async () => {
    const { agent } = await signUp();
    await agent.post('/api/attempts').send({ ...STEP, answer: WRONG });
    await agent.post('/api/attempts').send({ ...STEP, answer: RIGHT, mode: 'review' });
    await travel(agent, '2026-10-31T09:00:00Z');
    await agent.post('/api/attempts').send({ ...STEP, answer: WRONG, mode: 'review' });
    expect((await agent.get('/api/me/review')).body.items[0].box).toBe(0);
    const shown = await agent
      .post('/api/attempts')
      .send({ ...STEP, answer: RIGHT, mode: 'review', answerShown: true });
    expect(shown.body.pointsAwarded).toBe(0);
    expect((await agent.get('/api/me/review')).body.items).toHaveLength(1);
    const hinted = await agent
      .post('/api/attempts')
      .send({ ...STEP, answer: RIGHT, mode: 'review', hintUsed: true });
    expect(hinted.body.pointsAwarded).toBe(25);
  });
});

describe('streak freeze', () => {
  it('covers one missed day only when switched on, then waits a week', async () => {
    const { agent } = await signUp();
    await agent.post('/api/attempts').send({ ...STEP, answer: RIGHT }); // Oct 30
    await travel(agent, '2026-11-01T09:00:00Z'); // Oct 31 missed
    expect((await agent.get('/api/me/stats')).body.streak).toEqual({
      current: 0,
      longest: 1,
      frozen: false,
    });

    await agent.patch('/api/me/settings').send({ streakFreeze: true });
    expect((await agent.get('/api/me/stats')).body.streak).toEqual({
      current: 1,
      longest: 1,
      frozen: true,
    });
    await agent.post('/api/attempts').send(OTHER); // Nov 1: the freeze covers Oct 31
    expect((await agent.get('/api/me/stats')).body.streak).toMatchObject({
      current: 2,
      frozen: false,
    });

    // Miss Nov 2: the freeze was used 2 days ago, so the streak breaks.
    await travel(agent, '2026-11-03T09:00:00Z');
    expect((await agent.get('/api/me/stats')).body.streak.current).toBe(0);
  });
});

describe('unsubscribe', () => {
  it('turns reminders off from the email link, without a session, and rejects forged links', async () => {
    const { agent, res } = await signUp();
    await agent.patch('/api/me/settings').send({ emailOptIn: true });
    const id = res.body.id as string;
    const { unsubscribeToken } = await import('../lib/unsubscribe');
    const token = unsubscribeToken(id, config.jwtSecret);
    const app = makeApp();

    const forged = await request(app)
      .post(`/api/email/unsubscribe?u=${id}&t=${unsubscribeToken(id, 'not-the-secret')}`)
      .send({});
    expect([forged.status, forged.body.error.code]).toEqual([400, 'INVALID_LINK']);

    // One-click unsubscribe from a mail app is a form post, not JSON.
    const oneClick = await request(app)
      .post(`/api/email/unsubscribe?u=${id}&t=${token}`)
      .type('form')
      .send('List-Unsubscribe=One-Click');
    expect([oneClick.status, oneClick.body]).toEqual([200, { unsubscribed: true }]);
    expect((await agent.get('/api/me')).body.settings.emailOptIn).toBe(false);

    const again = await request(app).post('/api/email/unsubscribe').send({ u: id, t: token });
    expect(again.status).toBe(200);
  });
});

describe('weekly reminders', () => {
  const content = async () => {
    const dir = path.resolve(import.meta.dirname, '../../../../content');
    const copy = {} as Record<ContentLocale, EmailCopy>;
    for (const l of CONTENT_LOCALES) copy[l] = await loadEmailCopy(dir, l);
    return { copy, lessonTitle: (_l: ContentLocale, slug: string) => `Title of ${slug}` };
  };

  it('emails only learners who opted in, once a week, with a working unsubscribe link', async () => {
    const quiet = await signUp(makeApp(), 'سارة');
    const keen = await signUp(makeApp(), 'Omar');
    await keen.agent.patch('/api/me/settings').send({ emailOptIn: true, locale: 'en' });
    await keen.agent.post('/api/attempts').send({ ...STEP, answer: WRONG });

    const ctx = createContext(db, config);
    const mailer = new LogMailer();
    const first = await sendWeeklyReminders(ctx, mailer, await content());
    expect(first).toEqual({ periodKey: '2026-W44', sent: 1, skipped: 0 });
    expect(mailer.sent.map((m) => m.to)).toEqual([keen.res.body.email]);
    expect(mailer.sent.map((m) => m.to)).not.toContain(quiet.res.body.email);

    const email = mailer.sent[0]!;
    expect(email.subject).toBe('Your weekly Excel practice is waiting');
    expect(email.text).toContain('Hello Omar,');
    expect(email.text).toContain('You have 1 missed steps waiting for review.');
    // A miss alone does not start a lesson, so the first lesson is next.
    expect(email.text).toContain('Next lesson: Title of cells-and-selection');
    expect(email.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');

    // Same week: nothing more.
    expect(await sendWeeklyReminders(ctx, mailer, await content())).toMatchObject({
      sent: 0,
      skipped: 1,
    });
    expect(mailer.sent).toHaveLength(1);

    // The one-click link in the header works; next week nothing goes out.
    const link = new URL(email.headers['List-Unsubscribe']!.slice(1, -1));
    expect(link.origin).toBe('https://tamreen.test');
    const res = await request(makeApp())
      .post(`${link.pathname}${link.search}`)
      .type('form')
      .send('List-Unsubscribe=One-Click');
    expect(res.status).toBe(200);
    clock.now = new Date('2026-11-06T09:00:00Z');
    expect(await sendWeeklyReminders(ctx, mailer, await content())).toMatchObject({ sent: 0 });
    expect(mailer.sent).toHaveLength(1);
  });

  it('escapes the display name in the HTML body', async () => {
    const { agent } = await signUp(makeApp(), 'Ali <b>');
    await agent.patch('/api/me/settings').send({ emailOptIn: true });
    const mailer = new LogMailer();
    await sendWeeklyReminders(createContext(db, config), mailer, await content());
    expect(mailer.sent[0]!.html).toContain('Ali &#60;b&#62;');
    expect(mailer.sent[0]!.html).toContain('dir="rtl"');
  });
});
