import type { Prisma } from '../generated/prisma/client';
import { dayDate, keyOfDate, type DayKey } from '../lib/day';
import { REVIEW_POINTS, afterMiss, afterReview } from '../lib/review';
import { touchStreak } from './progress';

type Tx = Prisma.TransactionClient;

/** A miss puts the step in the review queue, due today; a step already queued starts over. */
export async function recordMiss(tx: Tx, userId: string, stepId: string, today: DayKey) {
  const slot = afterMiss(today);
  const data = { box: slot.box, dueDay: dayDate(slot.dueDay) };
  await tx.reviewItem.upsert({
    where: { userId_stepId: { userId, stepId } },
    create: { userId, stepId, ...data },
    update: data,
  });
}

/** The ledger reason for one scheduled review; unique per user, so it is paid at most once. */
export const reviewReason = (stepId: string, dueDay: DayKey) => `review:${stepId}:${dueDay}`;

/**
 * A correct answer from the review queue: if the step is due, it moves to its next spacing (or
 * leaves the queue) and the review pays its points. Returns the points paid.
 */
export async function recordReview(
  tx: Tx,
  userId: string,
  stepId: string,
  today: DayKey,
  flags: { hintUsed: boolean; answerShown: boolean },
): Promise<number> {
  const item = await tx.reviewItem.findUnique({ where: { userId_stepId: { userId, stepId } } });
  if (!item || keyOfDate(item.dueDay) > today || flags.answerShown) return 0;

  const next = afterReview(item.box, today);
  if (next) {
    await tx.reviewItem.update({
      where: { userId_stepId: { userId, stepId } },
      data: { box: next.box, dueDay: dayDate(next.dueDay) },
    });
  } else {
    await tx.reviewItem.delete({ where: { userId_stepId: { userId, stepId } } });
  }

  const points = flags.hintUsed ? REVIEW_POINTS / 2 : REVIEW_POINTS;
  const { count } = await tx.pointEvent.createMany({
    data: [
      {
        userId,
        delta: points,
        reason: reviewReason(stepId, keyOfDate(item.dueDay)),
        day: dayDate(today),
      },
    ],
    skipDuplicates: true,
  });
  if (count === 0) return 0;
  await touchStreak(tx, userId, today);
  return points;
}
