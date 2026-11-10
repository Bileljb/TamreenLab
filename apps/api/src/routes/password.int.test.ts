// Phase 9 (ADR 013): forgotten password, by an emailed single-use link.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { LogMailer } from '../lib/mailer';
import { clock, db, makeApp, resetDatabase, signUp } from '../test/harness';

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

function setup() {
  const mailer = new LogMailer();
  const app = makeApp({}, { mailer });
  return { mailer, app };
}

/** The token in the link of the last email sent. */
function tokenFrom(mailer: LogMailer): string {
  const link = /https:\/\/tamreen\.test\/(ar|en|fr)\/reset-password\?token=([\w-]+)/.exec(
    mailer.sent.at(-1)!.text,
  );
  expect(link).not.toBeNull();
  return link![2]!;
}

describe('POST /auth/password/forgot', () => {
  it('answers the same for unknown and known emails, and mails only the real account', async () => {
    const { mailer, app } = setup();
    const { user } = await signUp(app);

    const unknown = await request(app)
      .post('/api/auth/password/forgot')
      .send({ email: 'nobody@example.com' });
    expect(unknown.status).toBe(202);
    expect(mailer.sent).toHaveLength(0);

    const known = await request(app)
      .post('/api/auth/password/forgot')
      .send({ email: user.email.toUpperCase() });
    expect([known.status, known.body]).toEqual([202, unknown.body]);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.to).toBe(user.email);
    expect(mailer.sent[0]!.html).toContain('reset-password?token=');

    // Only a hash is stored.
    const token = tokenFrom(mailer);
    const row = await db.passwordResetToken.findFirstOrThrow();
    expect(row.tokenHash).not.toContain(token);
  });

  it('writes in the learner language', async () => {
    const { mailer, app } = setup();
    const res = await request(app).post('/api/auth/register').send({
      email: 'fr@example.com',
      password: 'correct horse',
      displayName: 'Claire',
      locale: 'fr',
    });
    expect(res.status).toBe(201);
    await request(app).post('/api/auth/password/forgot').send({ email: 'fr@example.com' });
    expect(mailer.sent[0]!.text).toContain('/fr/reset-password?token=');
    expect(mailer.sent[0]!.subject).toMatch(/mot de passe/i);
  });

  it('sends at most three links an hour to one account', async () => {
    const { mailer, app } = setup();
    const { user } = await signUp(app);
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/password/forgot').send({ email: user.email });
      expect(res.status).toBe(202);
    }
    expect(mailer.sent).toHaveLength(3);
    clock.now = new Date(clock.now.getTime() + 61 * 60_000);
    await request(app).post('/api/auth/password/forgot').send({ email: user.email });
    expect(mailer.sent).toHaveLength(4);
  });
});

describe('POST /auth/password/reset', () => {
  it('sets the new password once, and signs out every session', async () => {
    const { mailer, app } = setup();
    const { agent, user } = await signUp(app);
    await request(app).post('/api/auth/password/forgot').send({ email: user.email });
    const token = tokenFrom(mailer);

    const reset = await request(app)
      .post('/api/auth/password/reset')
      .send({ token, password: 'a brand new secret' });
    expect(reset.status).toBe(204);

    const login = (password: string) =>
      request(app).post('/api/auth/login').send({ email: user.email, password });
    expect((await login('correct horse')).status).toBe(401);
    expect((await login('a brand new secret')).status).toBe(200);
    expect((await agent.post('/api/auth/refresh').send({})).status).toBe(401);

    const again = await request(app)
      .post('/api/auth/password/reset')
      .send({ token, password: 'yet another secret' });
    expect([again.status, again.body.error.code]).toEqual([400, 'INVALID_RESET_TOKEN']);
  });

  it('refuses expired, replaced and made-up tokens, and short passwords', async () => {
    const { mailer, app } = setup();
    const { user } = await signUp(app);
    const reset = (token: string, password = 'a brand new secret') =>
      request(app).post('/api/auth/password/reset').send({ token, password });

    await request(app).post('/api/auth/password/forgot').send({ email: user.email });
    const first = tokenFrom(mailer);
    await request(app).post('/api/auth/password/forgot').send({ email: user.email });
    const second = tokenFrom(mailer);
    expect((await reset(first)).status).toBe(400); // replaced by the newer link

    expect((await reset(second, 'short')).status).toBe(400);
    clock.now = new Date(clock.now.getTime() + 31 * 60_000);
    expect((await reset(second)).status).toBe(400); // expired after 30 minutes
    expect((await reset('x'.repeat(43))).status).toBe(400);
  });
});
