import { Router } from 'express';
import { InvalidAnswerError, checkAnswer, scoreAttempt, type CheckResult } from '@tamreen/engine';
import { AttemptRequestSchema, type AttemptResponse } from '@tamreen/shared';
import type { Ctx } from '../context';
import type { Prisma } from '../generated/prisma/client';
import { HttpError } from '../lib/errors';
import { requireUser, userId } from '../middleware/auth';
import { payStep, refreshLessonProgress, touchStreak } from '../services/progress';
import { findStep, stepFromRow } from '../services/steps';

export function attemptsRouter(ctx: Ctx) {
  const router = Router();

  /**
   * The API is authoritative for points: the answer is re-checked here with the same engine the
   * browser uses, and nothing the client says about correctness is read (the body has no such field).
   */
  router.post('/attempts', requireUser, async (req, res) => {
    const uid = userId(req);
    const body = AttemptRequestSchema.parse(req.body);
    const row = await findStep(ctx, body.lessonSlug, body.stepSlug);
    const step = stepFromRow(row, body.locale);

    let result: CheckResult;
    try {
      result = checkAnswer(step, body.answer);
    } catch (e) {
      if (e instanceof InvalidAnswerError) {
        throw new HttpError(400, 'INVALID_ANSWER', 'The answer does not fit this step', e.issues);
      }
      throw e;
    }

    const response = await ctx.db.$transaction(async (tx) => {
      const firstTry = (await tx.attempt.count({ where: { userId: uid, stepId: row.id } })) === 0;
      await tx.attempt.create({
        data: {
          userId: uid,
          stepId: row.id,
          correct: result.correct,
          firstTry,
          timeMs: body.timeMs,
          answer: body.answer as Prisma.InputJsonValue,
        },
      });
      let pointsAwarded = 0;
      if (result.correct) {
        const points = scoreAttempt({
          basePoints: row.basePoints,
          timeMs: body.timeMs,
          firstTry,
          hintUsed: body.hintUsed,
          answerShown: body.answerShown,
        });
        const today = ctx.today();
        if (await payStep(tx, uid, row.id, points, today)) {
          pointsAwarded = points;
          await touchStreak(tx, uid, today);
          await refreshLessonProgress(tx, uid, row.lessonId, ctx.config.now());
        }
      }
      return {
        correct: result.correct,
        code: result.code,
        pointsAwarded,
        firstTry,
      } satisfies AttemptResponse;
    });
    res.json(response);
  });

  return router;
}
