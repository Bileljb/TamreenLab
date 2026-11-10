import { Router } from 'express';
import { levelFor } from '@tamreen/engine';
import {
  DAILY_GOALS,
  DEFAULT_DAILY_GOAL,
  SettingsUpdateSchema,
  type DailyGoal,
  type LessonProgressDto,
  type ReviewQueue,
  type Stats,
  type User,
} from '@tamreen/shared';
import type { Ctx } from '../context';
import type { User as UserRow } from '../generated/prisma/client';
import { dayDate } from '../lib/day';
import { HttpError } from '../lib/errors';
import { visibleStreak } from '../lib/streak';
import { requireUser, userId } from '../middleware/auth';
import { nextLesson, streakState } from '../services/progress';
import { exportUserData } from '../services/export';
import { clearSession } from '../services/session';

const asGoal = (n: number): DailyGoal =>
  (DAILY_GOALS as readonly number[]).includes(n) ? (n as DailyGoal) : DEFAULT_DAILY_GOAL;

export function toUserDto(user: UserRow, streak?: { freezeEnabled: boolean } | null): User {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
    settings: {
      dailyGoal: asGoal(user.dailyGoal),
      streakFreeze: streak?.freezeEnabled ?? false,
      emailOptIn: user.emailOptIn,
    },
  };
}

export function meRouter(ctx: Ctx) {
  const router = Router();
  router.use('/me', requireUser);

  async function loadUser(id: string) {
    const user = await ctx.db.user.findUnique({ where: { id }, include: { streak: true } });
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in first');
    return toUserDto(user, user.streak);
  }

  router.get('/me', async (req, res) => {
    res.json(await loadUser(userId(req)));
  });

  /** Changes the daily goal, the streak freeze and email reminders; any subset at a time. */
  router.patch('/me/settings', async (req, res) => {
    const id = userId(req);
    const body = SettingsUpdateSchema.parse(req.body);
    const now = ctx.config.now();
    await ctx.db.$transaction(async (tx) => {
      const current = await tx.user.findUniqueOrThrow({ where: { id } });
      await tx.user.update({
        where: { id },
        data: {
          ...(body.dailyGoal !== undefined && { dailyGoal: body.dailyGoal }),
          ...(body.locale !== undefined && { locale: body.locale }),
          ...(body.emailOptIn !== undefined && {
            emailOptIn: body.emailOptIn,
            // Keep when consent was given, for the record; clear it on opt-out.
            emailOptInAt: body.emailOptIn ? (current.emailOptInAt ?? now) : null,
          }),
        },
      });
      if (body.streakFreeze !== undefined) {
        await tx.streak.upsert({
          where: { userId: id },
          create: { userId: id, freezeEnabled: body.streakFreeze },
          update: { freezeEnabled: body.streakFreeze },
        });
      }
    });
    res.json(await loadUser(id));
  });

  /** Deletes the account and everything it owns (attempts, points, progress, streak, sessions). */
  router.delete('/me', async (req, res) => {
    await ctx.db.user.deleteMany({ where: { id: userId(req) } });
    clearSession(ctx, res);
    res.status(204).end();
  });

  // Everything stored about the learner, as a file to keep (ADR 013).
  router.get('/me/export', async (req, res) => {
    const data = await exportUserData(ctx, userId(req));
    const day = data.exportedAt.slice(0, 10);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="tamreenlab-data-${day}.json"`);
    res.json(data);
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

  /** The missed steps due for review today, oldest first (ADR 011). */
  router.get('/me/review', async (req, res) => {
    const items = await ctx.db.reviewItem.findMany({
      where: {
        userId: userId(req),
        dueDay: { lte: dayDate(ctx.today()) },
        step: { lesson: { status: { in: ctx.visibleStatuses } } },
      },
      include: { step: { include: { lesson: { include: { track: true } } } } },
      orderBy: [
        { dueDay: 'asc' },
        { step: { lesson: { order: 'asc' } } },
        { step: { order: 'asc' } },
      ],
      take: 20,
    });
    const body: ReviewQueue = {
      items: items.map((i) => ({
        lessonSlug: i.step.lesson.slug,
        stepSlug: i.step.slug,
        track: i.step.lesson.track.slug,
        box: i.box,
      })),
    };
    res.json(body);
  });

  router.get('/me/stats', async (req, res) => {
    const id = userId(req);
    const today = ctx.today();
    const [user, total, todayPoints, streak, completed, stepsDone, firstTry, reviewsDue] =
      await Promise.all([
        ctx.db.user.findUniqueOrThrow({ where: { id } }),
        ctx.db.pointEvent.aggregate({ where: { userId: id }, _sum: { delta: true } }),
        ctx.db.pointEvent.aggregate({
          where: { userId: id, day: dayDate(today) },
          _sum: { delta: true },
        }),
        ctx.db.streak.findUnique({ where: { userId: id } }),
        ctx.db.lessonProgress.count({ where: { userId: id, completedAt: { not: null } } }),
        ctx.db.pointEvent.count({ where: { userId: id, reason: { startsWith: 'step:' } } }),
        ctx.db.attempt.count({ where: { userId: id, firstTry: true, correct: true } }),
        ctx.db.reviewItem.count({
          where: {
            userId: id,
            dueDay: { lte: dayDate(today) },
            step: { lesson: { status: { in: ctx.visibleStatuses } } },
          },
        }),
      ]);
    const pointsTotal = total._sum.delta ?? 0;
    const state = streakState(streak);
    const options = { freeze: streak?.freezeEnabled };
    const shown = visibleStreak(state, today, options);
    const level = levelFor(pointsTotal);
    const body: Stats = {
      pointsToday: todayPoints._sum.delta ?? 0,
      pointsTotal,
      streak: {
        current: shown,
        longest: streak?.longest ?? 0,
        frozen: shown > 0 && shown !== visibleStreak(state, today),
      },
      lessonsCompleted: completed,
      firstTryAccuracy: stepsDone ? Math.min(1, firstTry / stepsDone) : null,
      level: { level: level.level, into: level.into, span: level.span },
      dailyGoal: asGoal(user.dailyGoal),
      reviewsDue,
      nextLesson: await nextLesson(ctx, id),
    };
    res.json(body);
  });

  return router;
}
