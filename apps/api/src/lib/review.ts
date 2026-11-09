import { addDays, type DayKey } from './day';

/**
 * "Review mistakes" spacing (ADR 011): a missed step is due the same day (box 0). Each correct
 * review moves it to the next box, due 1, 3 and then 7 days later; a correct review in the last box
 * takes it out of the queue. A wrong review puts it back in box 0, due today.
 */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7] as const;

/** Points for a correct review, paid once per scheduled review. */
export const REVIEW_POINTS = 50;

export type ReviewSlot = { box: number; dueDay: DayKey };

export function afterMiss(today: DayKey): ReviewSlot {
  return { box: 0, dueDay: today };
}

/** The next slot after a correct review in `box`, or null when the step has graduated. */
export function afterReview(box: number, today: DayKey): ReviewSlot | null {
  const interval = REVIEW_INTERVALS_DAYS[box];
  return interval === undefined ? null : { box: box + 1, dueDay: addDays(today, interval) };
}
