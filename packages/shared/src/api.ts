import { z } from 'zod';
import { GuestProgressSchema } from './progress';

/** Request and response bodies of the API (PLAN §3.6). Every route validates with these. */

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 30;

export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const PasswordSchema = z.string().min(8).max(128);
export const DisplayNameSchema = z
  .string()
  .transform((n) => n.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(DISPLAY_NAME_MIN).max(DISPLAY_NAME_MAX));

export const RegisterRequestSchema = z
  .object({ email: EmailSchema, password: PasswordSchema, displayName: DisplayNameSchema })
  .strict();
export type RegisterRequest = z.input<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z
  .object({ email: EmailSchema, password: z.string().min(1).max(128) })
  .strict();
export type LoginRequest = z.input<typeof LoginRequestSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const ProgressSyncRequestSchema = z.object({ guestProgress: GuestProgressSchema }).strict();
export type ProgressSyncRequest = z.input<typeof ProgressSyncRequestSchema>;

export const ProgressSyncResponseSchema = z.object({
  mergedSteps: z.number().int().nonnegative(),
  pointsAwarded: z.number().int().nonnegative(),
});
export type ProgressSyncResponse = z.infer<typeof ProgressSyncResponseSchema>;

export const LessonProgressDtoSchema = z.object({
  lessonSlug: z.string(),
  stepsDone: z.array(z.string()),
  totalSteps: z.number().int(),
  completedAt: z.string().nullable(),
  firstTryRate: z.number().nullable(),
});
export type LessonProgressDto = z.infer<typeof LessonProgressDtoSchema>;

export const StatsSchema = z.object({
  pointsToday: z.number().int(),
  pointsTotal: z.number().int(),
  streak: z.object({ current: z.number().int(), longest: z.number().int() }),
  lessonsCompleted: z.number().int(),
  firstTryAccuracy: z.number().nullable(),
});
export type Stats = z.infer<typeof StatsSchema>;

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  displayName: z.string(),
  points: z.number().int(),
  isMe: z.boolean(),
});
export const LeaderboardSchema = z.object({
  day: z.string(),
  entries: z.array(LeaderboardEntrySchema),
});
export type Leaderboard = z.infer<typeof LeaderboardSchema>;
