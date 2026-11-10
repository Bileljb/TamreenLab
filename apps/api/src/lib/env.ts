import { z } from 'zod';

const DEV_SECRET = 'dev-only-secret-not-for-production-use';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    /** Only the web server talks to the API; set 0.0.0.0 only on a private network (ADR 013). */
    HOST: z.string().min(1).default('127.0.0.1'),
    /**
     * Proxies in front of the web server that append the client address to X-Forwarded-For (a
     * load balancer, a CDN). Next.js forwards the header without adding to it. Required in
     * production: without it, client IPs are either shared or invented (ADR 013).
     */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(1).max(5).optional(),
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
    /** The public site address, for links in emails. */
    PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
    /** Email transport: `log` writes emails to the logs, `smtp` sends them (ADR 014). */
    MAIL_TRANSPORT: z.enum(['log', 'smtp']).default('log'),
    /** Any SMTP provider; Brevo for now (smtp-relay.brevo.com, port 587). */
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    /** Emails a day the provider allows, less a margin; reminders stop here (ADR 014). */
    MAIL_DAILY_LIMIT: z.coerce.number().int().positive().default(280),
    MAIL_FROM: z.string().min(3).default('TamreenLab <noreply@localhost>'),
    /** The AI formula assistant (ADR 012). Without a key it is off and the static hint shows. */
    GROQ_API_KEY: z.string().min(1).optional(),
    ASSISTANT_MODEL: z.string().min(1).default('qwen/qwen3.8-27b'),
    /** The model gets this long; then the static hint shows. Keeps p95 under 4 s. */
    ASSISTANT_TIMEOUT_MS: z.coerce.number().int().min(500).max(10_000).default(3500),
    /** Model calls per day; cached explanations do not count. */
    ASSISTANT_USER_DAILY: z.coerce.number().int().nonnegative().default(20),
    ASSISTANT_IP_DAILY: z.coerce.number().int().nonnegative().default(40),
    /** All tokens per day, under the provider's free-tier limit. */
    ASSISTANT_DAILY_TOKENS: z.coerce.number().int().nonnegative().default(200_000),
    /** The spend cap for a calendar month (UTC), at the prices below. */
    ASSISTANT_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(2),
    /** US dollars per million tokens: an upper estimate; check the provider's price list. */
    ASSISTANT_PRICE_INPUT_PER_M: z.coerce.number().nonnegative().default(0.6),
    ASSISTANT_PRICE_OUTPUT_PER_M: z.coerce.number().nonnegative().default(1.2),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Required in production' });
    }
    if (env.MAIL_TRANSPORT === 'smtp') {
      for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] as const) {
        if (!env[key])
          ctx.addIssue({ code: 'custom', path: [key], message: 'Required to send email' });
      }
    }
    if (env.NODE_ENV === 'production' && env.TRUST_PROXY_HOPS === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['TRUST_PROXY_HOPS'],
        message: 'Required in production',
      });
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
  // `KEY=` in a .env file means "not set", not an empty value.
  const set = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const result = EnvSchema.safeParse(set);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
