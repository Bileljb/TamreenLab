import { z } from 'zod';

const DEV_SECRET = 'dev-only-secret-not-for-production-use';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.url(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Signs access tokens. Required in production; at least 32 characters. */
    JWT_SECRET: z.string().min(32).optional(),
    /** Offset of the "day" used for streaks and the daily leaderboard (ADR 006). */
    DAY_UTC_OFFSET_MINUTES: z.coerce.number().int().min(-720).max(840).default(180),
    /** Serve DRAFT lessons too. Defaults to true outside production. */
    CONTENT_INCLUDE_DRAFTS: bool.optional(),
    COOKIE_SECURE: bool.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Required in production' });
    }
  })
  .transform((env) => ({
    ...env,
    JWT_SECRET: env.JWT_SECRET ?? DEV_SECRET,
    CONTENT_INCLUDE_DRAFTS: env.CONTENT_INCLUDE_DRAFTS ?? env.NODE_ENV !== 'production',
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
  }));

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
