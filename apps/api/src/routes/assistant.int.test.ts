// Phase 8 (ADR 012): the AI formula assistant, with a fake model in place of the provider.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { AssistantConfig } from '../config';
import type { ChatMessage } from '../lib/assistant';
import { GroqModel, type HintCompletion, type HintModel } from '../lib/hintModel';
import { clock, config, db, makeApp, resetDatabase, signUp } from '../test/harness';

beforeEach(async () => {
  await resetDatabase();
  await db.assistantCall.deleteMany();
  await db.assistantHint.deleteMany();
});
afterAll(() => db.$disconnect());

const HINT = 'النطاق يتوقف عند `B5`، فتنقص خلية من المجموع. مدّ النطاق إلى آخر خلية فيها كمية.';

/** Replies with `reply` (or what `reply` returns), and records every call. */
class FakeModel implements HintModel {
  readonly name = 'fake-model';
  readonly calls: ChatMessage[][] = [];
  constructor(
    private readonly reply: string | ((signal: AbortSignal) => Promise<string>) = HINT,
    private readonly usage = { inputTokens: 200, outputTokens: 60 },
  ) {}

  async complete(messages: ChatMessage[], signal: AbortSignal): Promise<HintCompletion> {
    this.calls.push(messages);
    const text = typeof this.reply === 'string' ? this.reply : await this.reply(signal);
    return { text, ...this.usage };
  }
}

function assistant(overrides: Partial<AssistantConfig> = {}): AssistantConfig {
  return { ...config.assistant, model: new FakeModel(), ...overrides };
}

const appWith = (overrides: Partial<AssistantConfig> = {}) =>
  makeApp({ assistant: assistant(overrides) });

const ask = (formula: string, extra: Record<string, unknown> = {}) => ({
  lessonSlug: 'sum-basics',
  stepSlug: 'sum-function',
  answer: { cell: 'B7', formula },
  ...extra,
});

describe('POST /assistant/hint', () => {
  it('explains a wrong formula, with the code the server found', async () => {
    const model = new FakeModel();
    const res = await request(appWith({ model }))
      .post('/api/assistant/hint')
      .send(ask('=SUM(B2:B5)'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ source: 'ai', id: expect.any(String), text: HINT });
    expect(model.calls).toHaveLength(1);
    const user = model.calls[0]![1]!.content;
    expect(user).toContain('`SUM`');
    expect(user).toContain('=SUM(B2:B6)');
    expect(user).toContain('WRONG_VALUE');

    const [call] = await db.assistantCall.findMany();
    expect(call).toMatchObject({
      outcome: 'ai',
      calledModel: true,
      inputTokens: 200,
      outputTokens: 60,
    });
    expect(call!.costMicros).toBe(Math.ceil(200 * 0.6 + 60 * 1.2));
    expect(call!.userKey).toBeNull();
    expect(call!.ipKey).not.toMatch(/127\.0\.0\.1|::1/);
  });

  it('does not take the feedback code from the client', async () => {
    const res = await request(appWith())
      .post('/api/assistant/hint')
      .send(ask('=SUM(B2:B5)', { code: 'SYNTAX_ERROR' }));
    expect(res.status).toBe(400);
  });

  it('caches by step, language and formula spelling', async () => {
    const model = new FakeModel();
    const app = appWith({ model });
    const first = await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B5)'));
    const again = await request(app).post('/api/assistant/hint').send(ask('sum( b2 : b5 )'));
    expect(again.body).toEqual(first.body);
    expect(model.calls).toHaveLength(1);
    expect(
      (await db.assistantCall.findMany({ orderBy: { createdAt: 'asc' } })).map((c) => c.outcome),
    ).toEqual(['ai', 'cached']);

    await request(app)
      .post('/api/assistant/hint')
      .send(ask('=SUM(B2:B5)', { locale: 'en' }));
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1]![0]!.content).toMatch(/in English/);
  });

  it('refuses a correct formula, other step types and unknown steps', async () => {
    const model = new FakeModel();
    const app = appWith({ model });
    const correct = await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B6)'));
    expect(correct.status).toBe(409);
    expect(correct.body.error.code).toBe('ANSWER_CORRECT');

    const choice = await request(app)
      .post('/api/assistant/hint')
      .send(ask('=1', { stepSlug: 'read-a-sum' }));
    expect(choice.status).toBe(400);
    expect(choice.body.error.code).toBe('NOT_FORMULA_STEP');

    const missing = await request(app)
      .post('/api/assistant/hint')
      .send(ask('=1', { stepSlug: 'no-such-step' }));
    expect(missing.status).toBe(404);
    expect(model.calls).toHaveLength(0);
  });

  it('gives the static hint when no provider is configured', async () => {
    const res = await request(appWith({ model: null }))
      .post('/api/assistant/hint')
      .send(ask('=SUM(B2:B5)'));
    expect(res.body).toEqual({ source: 'static', reason: 'DISABLED' });
  });

  it('gives the static hint when the provider is unreachable', async () => {
    const model = new GroqModel('test-key', 'qwen/qwen3.8-27b', 'http://127.0.0.1:9/v1/chat');
    const res = await request(appWith({ model }))
      .post('/api/assistant/hint')
      .send(ask('=SUM(B2:B5)'));
    expect(res.body).toEqual({ source: 'static', reason: 'UNAVAILABLE' });
    expect((await db.assistantCall.findFirstOrThrow()).outcome).toBe('UNAVAILABLE');
  });

  it('stops waiting at the timeout', async () => {
    const hang = (signal: AbortSignal) =>
      new Promise<string>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      });
    const started = Date.now();
    const res = await request(appWith({ model: new FakeModel(hang), timeoutMs: 200 }))
      .post('/api/assistant/hint')
      .send(ask('=SUM(B2:B5)'));
    expect(res.body).toEqual({ source: 'static', reason: 'UNAVAILABLE' });
    expect(Date.now() - started).toBeLessThan(2000);
    expect((await db.assistantCall.findFirstOrThrow()).latencyMs).toBeGreaterThanOrEqual(200);
  });

  it('never shows or caches a reply that gives the answer away', async () => {
    const model = new FakeModel('اكتب `=sum(B2:B6)` وانتهى الأمر.');
    const app = appWith({ model });
    const res = await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B5)'));
    expect(res.body).toEqual({ source: 'static', reason: 'UNSAFE' });
    await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B5)'));
    expect(model.calls).toHaveLength(2);
    expect(await db.assistantHint.count()).toBe(0);
  });
});

describe('quotas and caps', () => {
  it('limits model calls per learner per day; cached explanations stay free', async () => {
    const model = new FakeModel();
    const app = appWith({ model, userDaily: 2, ipDaily: 100 });
    const { agent } = await signUp(app);
    for (const f of ['=SUM(B2:B3)', '=SUM(B2:B4)']) {
      expect((await agent.post('/api/assistant/hint').send(ask(f))).body.source).toBe('ai');
    }
    expect((await agent.post('/api/assistant/hint').send(ask('=SUM(B2:B5)'))).body).toEqual({
      source: 'static',
      reason: 'QUOTA',
    });
    expect((await agent.post('/api/assistant/hint').send(ask('=SUM(B2:B3)'))).body.source).toBe(
      'ai',
    );
    expect(model.calls).toHaveLength(2);

    clock.now = new Date('2026-10-31T09:00:00Z');
    expect((await agent.post('/api/auth/refresh').send({})).status).toBe(200);
    expect((await agent.post('/api/assistant/hint').send(ask('=SUM(B2:B5)'))).body.source).toBe(
      'ai',
    );
  });

  it('limits guests per IP address', async () => {
    const app = appWith({ ipDaily: 1 });
    expect(
      (await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B3)'))).body.source,
    ).toBe('ai');
    expect((await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B4)'))).body).toEqual({
      source: 'static',
      reason: 'QUOTA',
    });
  });

  it('stops calling the model once the monthly budget is spent', async () => {
    const model = new FakeModel();
    const app = appWith({ model, monthlyBudgetMicros: 100 });
    // 200 × 0.6 + 60 × 1.2 = 192 micro-dollars: the first call spends the whole budget.
    expect(
      (await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B3)'))).body.source,
    ).toBe('ai');
    expect((await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B4)'))).body).toEqual({
      source: 'static',
      reason: 'BUDGET',
    });
    expect(model.calls).toHaveLength(1);

    // A new calendar month starts with a new budget.
    clock.now = new Date('2026-11-01T09:00:00Z');
    expect(
      (await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B4)'))).body.source,
    ).toBe('ai');
  });

  it('a zero budget never calls the model', async () => {
    const model = new FakeModel();
    const res = await request(appWith({ model, monthlyBudgetMicros: 0 }))
      .post('/api/assistant/hint')
      .send(ask('=SUM(B2:B5)'));
    expect(res.body).toEqual({ source: 'static', reason: 'BUDGET' });
    expect(model.calls).toHaveLength(0);
  });

  it('stops for the day at the token cap', async () => {
    // One call uses 260 tokens.
    const app = appWith({ dailyTokens: 250 });
    expect(
      (await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B3)'))).body.source,
    ).toBe('ai');
    expect((await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B4)'))).body).toEqual({
      source: 'static',
      reason: 'BUDGET',
    });
  });
});

describe('POST /assistant/hints/:id/feedback', () => {
  it('stores one vote per person, which they can change', async () => {
    const app = appWith();
    const { body } = await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B5)'));
    const url = `/api/assistant/hints/${body.id}/feedback`;

    expect((await request(app).post(url).send({ helpful: true })).status).toBe(204);
    expect((await request(app).post(url).send({ helpful: false })).status).toBe(204);
    const { agent } = await signUp(app);
    expect((await agent.post(url).send({ helpful: true })).status).toBe(204);

    const votes = await db.assistantFeedback.findMany({ orderBy: { createdAt: 'asc' } });
    expect(votes.map((v) => v.helpful)).toEqual([false, true]);
  });

  it('rejects unknown hints and bad bodies', async () => {
    const app = appWith();
    expect(
      (await request(app).post('/api/assistant/hints/nope/feedback').send({ helpful: true }))
        .status,
    ).toBe(404);
    const { body } = await request(app).post('/api/assistant/hint').send(ask('=SUM(B2:B5)'));
    expect(
      (await request(app).post(`/api/assistant/hints/${body.id}/feedback`).send({ helpful: 'yes' }))
        .status,
    ).toBe(400);
  });
});
