import type { Stats } from '@tamreen/shared';
import type { Ctx } from '../context';
import type { Prisma } from '../generated/prisma/client';
import { dayDate, keyOfDate, type DayKey } from '../lib/day';
import { nextStreak, type StreakState } from '../lib/streak';
import { stepReason } from './steps';

type Tx = Prisma.TransactionClient;

/**
 * Pays a completed step into the ledger. Returns false if this user was already paid for it, which
 * the unique (userId, reason) index guarantees even under concurrent requests.
 */
export async function payStep(tx: Tx, userId: string, stepId: string, points: number, day: DayKey) {
  const { count } = await tx.pointEvent.createMany({
    data: [{ userId, delta: points, reason: stepReason(stepId), day: dayDate(day) }],
    skipDuplicates: true,
  });
  return count === 1;
}

type StreakRow = {
  current: number;
  longest: number;
  lastDay: Date | null;
  freezeUsedOn: Date | null;
};

/** A stored streak as the pure streak functions see it. */
export function streakState(row: StreakRow | null): StreakState | null {
  return (
    row && {
      current: row.current,
      longest: row.longest,
      lastDay: row.lastDay ? keyOfDate(row.lastDay) : null,
      freezeUsedOn: row.freezeUsedOn ? keyOfDate(row.freezeUsedOn) : null,
    }
  );
}

/** Counts today as an active day for the streak, using the learner's freeze if it is on. */
export async function touchStreak(tx: Tx, userId: string, day: DayKey) {
  const current = await tx.streak.findUnique({ where: { userId } });
  const next = nextStreak(streakState(current), day, { freeze: current?.freezeEnabled });
  const data = {
    current: next.current,
    longest: next.longest,
    lastDay: dayDate(day),
    freezeUsedOn: next.freezeUsedOn ? dayDate(next.freezeUsedOn) : null,
  };
  await tx.streak.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

/**
 * Recomputes a user's progress in a lesson from the ledger (a step is done once it was paid) and
 * the attempts (first-try rate). Called after every change, so it can never drift.
 */
export async function refreshLessonProgress(tx: Tx, userId: string, lessonId: string, at: Date) {
  const steps = await tx.step.findMany({ where: { lessonId }, select: { id: true } });
  const ids = steps.map((s) => s.id);
  const done = await tx.pointEvent.findMany({
    where: { userId, reason: { in: ids.map(stepReason) } },
    select: { reason: true },
  });
  const firstTry = await tx.attempt.count({
    where: { userId, stepId: { in: ids }, firstTry: true, correct: true },
  });
  const stepsDone = done.length;
  const existing = await tx.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });
  const completedAt =
    existing?.completedAt ?? (stepsDone > 0 && stepsDone === ids.length ? at : null);
  const data = {
    stepsDone,
    completedAt,
    firstTryRate: stepsDone ? Math.min(1, firstTry / stepsDone) : null,
  };
  await tx.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, ...data },
    update: data,
  });
}

/**
 * Where to continue: the first lesson in curriculum order that was started and not finished, or
 * else the first one not finished yet. Null once everything is done.
 */
export async function nextLesson(ctx: Ctx, userId: string): Promise<Stats['nextLesson']> {
  const [lessons, progress] = await Promise.all([
    ctx.db.lesson.findMany({
      where: { status: { in: ctx.visibleStatuses } },
      orderBy: { order: 'asc' },
      select: { id: true, slug: true, track: { select: { slug: true } } },
    }),
    ctx.db.lessonProgress.findMany({ where: { userId } }),
  ]);
  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
  const pick =
    lessons.find((l) => {
      const p = byLesson.get(l.id);
      return p && p.stepsDone > 0 && !p.completedAt;
    }) ?? lessons.find((l) => !byLesson.get(l.id)?.completedAt);
  return pick ? { slug: pick.slug, track: pick.track.slug } : null;
}
