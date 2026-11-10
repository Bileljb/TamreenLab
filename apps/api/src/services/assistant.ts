import { createHmac } from 'node:crypto';
import { InvalidAnswerError, checkAnswer } from '@tamreen/engine';
import type {
  AssistantFallbackReason,
  AssistantHintRequestSchema,
  AssistantHintResponse,
} from '@tamreen/shared';
import type { z } from 'zod';
import type { Ctx } from '../context';
import {
  buildHintMessages,
  cleanHint,
  costMicros,
  formulaKey,
  revealsSolution,
  type TokenUsage,
} from '../lib/assistant';
import { dayDate } from '../lib/day';
import { HttpError } from '../lib/errors';
import { findStep, stepFromRow } from './steps';

type HintRequest = z.output<typeof AssistantHintRequestSchema>;
export type Requester = { userId?: string; ip: string };

/** A user id or IP address as stored: keyed, so rows never hold either (ADR 012). */
function keyed(ctx: Ctx, purpose: string, value: string): string {
  return createHmac('sha256', ctx.config.jwtSecret)
    .update(`assistant-${purpose}:${value}`)
    .digest('base64url');
}

function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Why the model may not be called now, if it may not: quota first, then the caps. */
async function blocked(
  ctx: Ctx,
  who: { userKey: string | null; ipKey: string },
  day: Date,
): Promise<AssistantFallbackReason | null> {
  const { assistant } = ctx.config;
  // Signed-in learners have their own quota; guests share one per IP address.
  const [mine, limit] = who.userKey
    ? [{ userKey: who.userKey }, assistant.userDaily]
    : [{ ipKey: who.ipKey }, assistant.ipDaily];
  const used = await ctx.db.assistantCall.count({ where: { day, calledModel: true, ...mine } });
  if (used >= limit) return 'QUOTA';

  const [today, month] = await Promise.all([
    ctx.db.assistantCall.aggregate({
      where: { day },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    ctx.db.assistantCall.aggregate({
      where: { createdAt: { gte: monthStart(ctx.config.now()) } },
      _sum: { costMicros: true },
    }),
  ]);
  const tokens = (today._sum.inputTokens ?? 0) + (today._sum.outputTokens ?? 0);
  if (tokens >= assistant.dailyTokens) return 'BUDGET';
  if ((month._sum.costMicros ?? 0) >= assistant.monthlyBudgetMicros) return 'BUDGET';
  return null;
}

/**
 * Explains a wrong formula (PLAN Phase 8). The formula is checked again here, so the feedback
 * code the model reads is the server's. Every way this can fail ends in the static hint, which
 * the page already has in its language.
 */
export async function explainFormula(
  ctx: Ctx,
  body: HintRequest,
  requester: Requester,
  onError: (error: unknown) => void = () => undefined,
): Promise<AssistantHintResponse> {
  const started = performance.now();
  const row = await findStep(ctx, body.lessonSlug, body.stepSlug);
  const step = stepFromRow(row, body.locale);
  if (step.type !== 'ENTER_FORMULA') {
    throw new HttpError(400, 'NOT_FORMULA_STEP', 'The assistant explains formula steps only');
  }
  let code;
  try {
    const result = checkAnswer(step, body.answer);
    if (result.correct) throw new HttpError(409, 'ANSWER_CORRECT', 'This formula is correct');
    code = result.code;
  } catch (e) {
    if (e instanceof InvalidAnswerError) {
      throw new HttpError(400, 'INVALID_ANSWER', 'The answer does not fit this step', e.issues);
    }
    throw e;
  }

  const who = {
    userKey: requester.userId ? keyed(ctx, 'user', requester.userId) : null,
    ipKey: keyed(ctx, 'ip', requester.ip),
  };
  const day = dayDate(ctx.today());
  const log = (outcome: string, calledModel = false, usage?: TokenUsage) =>
    ctx.db.assistantCall.create({
      data: {
        day,
        ...who,
        outcome,
        calledModel,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        costMicros: usage ? costMicros(usage, ctx.config.assistant.prices) : 0,
        latencyMs: Math.round(performance.now() - started),
        createdAt: ctx.config.now(),
      },
    });
  const fallback = async (
    reason: AssistantFallbackReason,
    calledModel = false,
    usage?: TokenUsage,
  ): Promise<AssistantHintResponse> => {
    await log(reason, calledModel, usage);
    return { source: 'static', reason };
  };

  const cacheKey = {
    stepId: row.id,
    locale: body.locale,
    formulaKey: formulaKey(body.answer.formula),
  };
  const cached = await ctx.db.assistantHint.findUnique({
    where: { stepId_locale_formulaKey: cacheKey },
  });
  if (cached) {
    await log('cached');
    return { source: 'ai', id: cached.id, text: cached.text };
  }

  const { model, timeoutMs } = ctx.config.assistant;
  if (!model) return fallback('DISABLED');
  const reason = await blocked(ctx, who, day);
  if (reason) return fallback(reason);

  const messages = buildHintMessages({
    promptAr: step.promptAr,
    solution: step.check.solution,
    formula: body.answer.formula,
    code,
    locale: body.locale,
  });
  let completion;
  try {
    completion = await model.complete(messages, AbortSignal.timeout(timeoutMs));
  } catch (e) {
    onError(e);
    return fallback('UNAVAILABLE', true);
  }
  const text = cleanHint(completion.text);
  if (!text) return fallback('UNAVAILABLE', true, completion);
  if (revealsSolution(text, step.check.solution)) return fallback('UNSAFE', true, completion);

  // Two learners asking at once both reach here; the second keeps the first one's text.
  const hint = await ctx.db.assistantHint.upsert({
    where: { stepId_locale_formulaKey: cacheKey },
    create: { ...cacheKey, code, text, model: model.name, createdAt: ctx.config.now() },
    update: {},
  });
  await log('ai', true, completion);
  return { source: 'ai', id: hint.id, text: hint.text };
}

/** Helpful or not, stored for review; a second vote by the same person replaces the first. */
export async function recordHintFeedback(
  ctx: Ctx,
  hintId: string,
  helpful: boolean,
  requester: Requester,
) {
  const hint = await ctx.db.assistantHint.findUnique({ where: { id: hintId } });
  if (!hint) throw new HttpError(404, 'HINT_NOT_FOUND', 'No such explanation');
  const voter = requester.userId
    ? keyed(ctx, 'user', requester.userId)
    : keyed(ctx, 'ip', requester.ip);
  await ctx.db.assistantFeedback.upsert({
    where: { hintId_voter: { hintId, voter } },
    create: { hintId, voter, helpful },
    update: { helpful },
  });
}
