import type { Prisma } from '../generated/prisma/client';
import { dayDate, keyOfDate, type DayKey } from '../lib/day';
import { nextStreak } from '../lib/streak';
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

/** Counts today as an active day for the streak. */
export async function touchStreak(tx: Tx, userId: string, day: DayKey) {
  const current = await tx.streak.findUnique({ where: { userId } });
  const next = nextStreak(
    current && { ...current, lastDay: current.lastDay ? keyOfDate(current.lastDay) : null },
    day,
  );
  const data = { current: next.current, longest: next.longest, lastDay: dayDate(day) };
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
