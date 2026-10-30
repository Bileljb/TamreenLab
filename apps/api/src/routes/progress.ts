import { Router } from 'express';
import { ProgressSyncRequestSchema, type ProgressSyncResponse } from '@tamreen/shared';
import type { Ctx } from '../context';
import { planGuestMerge } from '../lib/merge';
import { requireUser, userId } from '../middleware/auth';
import { payStep, refreshLessonProgress, touchStreak } from '../services/progress';

export function progressRouter(ctx: Ctx) {
  const router = Router();

  /** Merges guest progress into the account after sign-up or sign-in. Idempotent and capped. */
  router.post('/progress/sync', requireUser, async (req, res) => {
    const uid = userId(req);
    const { guestProgress } = ProgressSyncRequestSchema.parse(req.body);
    const lessonSlugs = Object.keys(guestProgress.lessons);

    const response = await ctx.db.$transaction(async (tx) => {
      const steps = await tx.step.findMany({
        where: { lesson: { slug: { in: lessonSlugs }, status: { in: ctx.visibleStatuses } } },
        include: { lesson: { select: { slug: true } } },
      });
      const paid = await tx.pointEvent.findMany({
        where: { userId: uid, reason: { in: steps.map((s) => `step:${s.id}`) } },
        select: { reason: true },
      });
      const alreadyDone = new Set(paid.map((p) => p.reason.slice('step:'.length)));
      const awards = planGuestMerge(
        guestProgress,
        steps.map((s) => ({
          id: s.id,
          lessonSlug: s.lesson.slug,
          slug: s.slug,
          basePoints: s.basePoints,
        })),
        alreadyDone,
      );

      const today = ctx.today();
      let mergedSteps = 0;
      let pointsAwarded = 0;
      const lessons = new Set<string>();
      for (const award of awards) {
        if (!(await payStep(tx, uid, award.step.id, award.points, today))) continue;
        await tx.attempt.create({
          data: {
            userId: uid,
            stepId: award.step.id,
            correct: true,
            firstTry: award.firstTry,
            timeMs: 0,
            answer: { source: 'guest-sync' },
          },
        });
        mergedSteps++;
        pointsAwarded += award.points;
        lessons.add(steps.find((s) => s.id === award.step.id)!.lessonId);
      }
      if (mergedSteps > 0) await touchStreak(tx, uid, today);
      for (const lessonId of lessons)
        await refreshLessonProgress(tx, uid, lessonId, ctx.config.now());
      return { mergedSteps, pointsAwarded } satisfies ProgressSyncResponse;
    });
    res.json(response);
  });

  return router;
}
