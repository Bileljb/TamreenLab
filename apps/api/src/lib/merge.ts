import type { GuestProgress } from '@tamreen/shared';

/** Most points one guest-progress merge can award (ADR 006). */
export const MERGE_POINTS_CAP = 3000;

export type KnownStep = { id: string; lessonSlug: string; slug: string; basePoints: number };

export type MergeAward = { step: KnownStep; points: number; firstTry: boolean };

/**
 * What a guest-progress merge awards. Guest answers were never verified by the server, so a step
 * earns its flat base points (no bonuses), steps the user already completed earn nothing, unknown
 * slugs are ignored, and the total is capped. Steps beyond the cap are still merged, with 0 points.
 */
export function planGuestMerge(
  guest: GuestProgress,
  steps: KnownStep[],
  alreadyDone: Set<string>,
  cap = MERGE_POINTS_CAP,
): MergeAward[] {
  const bySlug = new Map(steps.map((s) => [`${s.lessonSlug}/${s.slug}`, s]));
  const awards: MergeAward[] = [];
  let remaining = cap;
  for (const [lessonSlug, lesson] of Object.entries(guest.lessons)) {
    for (const stepSlug of new Set(lesson.stepsDone)) {
      const step = bySlug.get(`${lessonSlug}/${stepSlug}`);
      if (!step || alreadyDone.has(step.id)) continue;
      const points = Math.min(step.basePoints, remaining);
      remaining -= points;
      awards.push({ step, points, firstTry: lesson.firstTry.includes(stepSlug) });
    }
  }
  return awards;
}
