import { Router } from 'express';
import type { LessonProgressDto, Stats, User } from '@tamreen/shared';
import type { Ctx } from '../context';
import type { User as UserRow } from '../generated/prisma/client';
import { dayDate, keyOfDate } from '../lib/day';
import { HttpError } from '../lib/errors';
import { visibleStreak } from '../lib/streak';
import { requireUser, userId } from '../middleware/auth';
import { clearSession } from '../services/session';

export function toUserDto(user: UserRow): User {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

export function meRouter(ctx: Ctx) {
  const router = Router();
  router.use('/me', requireUser);

  router.get('/me', async (req, res) => {
    const user = await ctx.db.user.findUnique({ where: { id: userId(req) } });
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in first');
    res.json(toUserDto(user));
  });

  /** Deletes the account and everything it owns (attempts, points, progress, streak, sessions). */
  router.delete('/me', async (req, res) => {
    await ctx.db.user.deleteMany({ where: { id: userId(req) } });
    clearSession(ctx, res);
    res.status(204).end();
  });

  router.get('/me/progress', async (req, res) => {
    const id = userId(req);
    const [progress, events] = await Promise.all([
      ctx.db.lessonProgress.findMany({
        where: { userId: id },
        include: { lesson: { include: { steps: { select: { id: true, slug: true } } } } },
        orderBy: { lesson: { order: 'asc' } },
      }),
      ctx.db.pointEvent.findMany({ where: { userId: id }, select: { reason: true } }),
    ]);
    const paid = new Set(events.map((e) => e.reason));
    const body: LessonProgressDto[] = progress.map((p) => ({
      lessonSlug: p.lesson.slug,
      stepsDone: p.lesson.steps.filter((s) => paid.has(`step:${s.id}`)).map((s) => s.slug),
      totalSteps: p.lesson.steps.length,
      completedAt: p.completedAt?.toISOString() ?? null,
      firstTryRate: p.firstTryRate,
    }));
    res.json(body);
  });

  router.get('/me/stats', async (req, res) => {
    const id = userId(req);
    const today = ctx.today();
    const [total, todayPoints, streak, completed, stepsDone, firstTry] = await Promise.all([
      ctx.db.pointEvent.aggregate({ where: { userId: id }, _sum: { delta: true } }),
      ctx.db.pointEvent.aggregate({
        where: { userId: id, day: dayDate(today) },
        _sum: { delta: true },
      }),
      ctx.db.streak.findUnique({ where: { userId: id } }),
      ctx.db.lessonProgress.count({ where: { userId: id, completedAt: { not: null } } }),
      ctx.db.pointEvent.count({ where: { userId: id, reason: { startsWith: 'step:' } } }),
      ctx.db.attempt.count({ where: { userId: id, firstTry: true, correct: true } }),
    ]);
    const body: Stats = {
      pointsToday: todayPoints._sum.delta ?? 0,
      pointsTotal: total._sum.delta ?? 0,
      streak: {
        current: visibleStreak(
          streak && { ...streak, lastDay: streak.lastDay ? keyOfDate(streak.lastDay) : null },
          today,
        ),
        longest: streak?.longest ?? 0,
      },
      lessonsCompleted: completed,
      firstTryAccuracy: stepsDone ? Math.min(1, firstTry / stepsDone) : null,
    };
    res.json(body);
  });

  return router;
}
