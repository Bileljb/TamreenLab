import type { Env } from './lib/env';

export type AppConfig = {
  jwtSecret: string;
  dayOffsetMinutes: number;
  includeDrafts: boolean;
  cookieSecure: boolean;
  /** Requests allowed per window; tests raise them. */
  rateLimits: { auth: number; attempts: number; general: number };
  /** The clock, injectable for tests. */
  now: () => Date;
};

export const DEFAULT_RATE_LIMITS = { auth: 20, attempts: 120, general: 300 };

export function configFromEnv(env: Env): AppConfig {
  return {
    jwtSecret: env.JWT_SECRET,
    dayOffsetMinutes: env.DAY_UTC_OFFSET_MINUTES,
    includeDrafts: env.CONTENT_INCLUDE_DRAFTS,
    cookieSecure: env.COOKIE_SECURE,
    rateLimits: DEFAULT_RATE_LIMITS,
    now: () => new Date(),
  };
}
