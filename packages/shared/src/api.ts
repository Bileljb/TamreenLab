import { z } from 'zod';
import { CONTENT_LOCALES } from './i18n';
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
  .object({
    email: EmailSchema,
    password: PasswordSchema,
    displayName: DisplayNameSchema,
    /** Weekly reminder emails; only an explicit `true` opts in (ADR 011). */
    emailOptIn: z.boolean().default(false),
    /** The site language at sign-up; emails are written in it. */
    locale: z.enum(CONTENT_LOCALES).default('ar'),
  })
  .strict();
export type RegisterRequest = z.input<typeof RegisterRequestSchema>;

/** The daily points goals a learner can choose from (ADR 011). */
export const DAILY_GOALS = [300, 900, 1800] as const;
export type DailyGoal = (typeof DAILY_GOALS)[number];
export const DEFAULT_DAILY_GOAL: DailyGoal = 900;

export const SettingsSchema = z.object({
  dailyGoal: z.literal(DAILY_GOALS),
  streakFreeze: z.boolean(),
  emailOptIn: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

/** `PATCH /me/settings`: any subset of the settings, and the current site language. */
export const SettingsUpdateSchema = SettingsSchema.partial()
  .extend({ locale: z.enum(CONTENT_LOCALES).optional() })
  .strict();
export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;

export const LoginRequestSchema = z
  .object({ email: EmailSchema, password: z.string().min(1).max(128) })
  .strict();
export type LoginRequest = z.input<typeof LoginRequestSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
  settings: SettingsSchema,
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
  streak: z.object({
    current: z.number().int(),
    longest: z.number().int(),
    /** True while a streak freeze is covering yesterday. */
    frozen: z.boolean(),
  }),
  lessonsCompleted: z.number().int(),
  firstTryAccuracy: z.number().nullable(),
  level: z.object({ level: z.number().int(), into: z.number().int(), span: z.number().int() }),
  dailyGoal: z.number().int(),
  /** Missed steps due for review today. */
  reviewsDue: z.number().int(),
  /** The next unfinished lesson, for "continue where you left off". */
  nextLesson: z.object({ slug: z.string(), track: z.string() }).nullable(),
});
export type Stats = z.infer<typeof StatsSchema>;

/** Points for a correct review from the "review mistakes" queue, paid once per scheduled review. */
export const REVIEW_POINTS = 50;

/**
 * `GET /me/review`: the steps due for review today. Only slugs: the page loads the step text in
 * the learner's language from the content (the database keeps the Arabic source only).
 */
export const ReviewQueueSchema = z.object({
  items: z.array(
    z.object({
      lessonSlug: z.string(),
      stepSlug: z.string(),
      track: z.string(),
      box: z.number().int(),
    }),
  ),
});
export type ReviewQueue = z.infer<typeof ReviewQueueSchema>;

/** `POST /email/unsubscribe`: the user id and token from the email's link. */
export const UnsubscribeRequestSchema = z
  .object({ u: z.string().min(1).max(64), t: z.string().min(1).max(128) })
  .strict();

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
