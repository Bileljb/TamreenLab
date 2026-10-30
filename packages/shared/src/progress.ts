import { z } from 'zod';

/** localStorage key for guest progress. Bump the version when the shape changes. */
export const GUEST_PROGRESS_KEY = 'tamreen.progress.v1';

export const LessonProgressSchema = z.object({
  /** Slugs of the steps finished correctly (not skipped, not revealed). */
  stepsDone: z.array(z.string()).default([]),
  /** Slugs of the steps answered correctly on the first attempt. */
  firstTry: z.array(z.string()).default([]),
  points: z.number().int().nonnegative().default(0),
  completedAt: z.iso.datetime().optional(),
});
export type LessonProgress = z.output<typeof LessonProgressSchema>;

/** Guest progress, kept in the browser and merged by `POST /progress/sync` in Phase 4. */
export const GuestProgressSchema = z.object({
  version: z.literal(1),
  lessons: z.record(z.string(), LessonProgressSchema).default({}),
});
export type GuestProgress = z.output<typeof GuestProgressSchema>;

export const emptyGuestProgress = (): GuestProgress => ({ version: 1, lessons: {} });
