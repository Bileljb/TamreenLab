import type { TokenPrices } from './lib/assistant';
import type { Env } from './lib/env';
import { GroqModel, type HintModel } from './lib/hintModel';

export type AssistantConfig = {
  /** Null when no provider key is set: every request gets the static hint. */
  model: HintModel | null;
  timeoutMs: number;
  userDaily: number;
  ipDaily: number;
  dailyTokens: number;
  monthlyBudgetMicros: number;
  prices: TokenPrices;
};

export type AppConfig = {
  jwtSecret: string;
  dayOffsetMinutes: number;
  includeDrafts: boolean;
  cookieSecure: boolean;
  /** Requests allowed per window; tests raise them. */
  rateLimits: { auth: number; attempts: number; general: number; assistant: number };
  /** The public site address, for links in emails (no trailing slash). */
  siteUrl: string;
  mailFrom: string;
  assistant: AssistantConfig;
  /** The clock, injectable for tests. */
  now: () => Date;
};

export const DEFAULT_RATE_LIMITS = { auth: 20, attempts: 120, general: 300, assistant: 10 };

export function configFromEnv(env: Env): AppConfig {
  return {
    jwtSecret: env.JWT_SECRET,
    dayOffsetMinutes: env.DAY_UTC_OFFSET_MINUTES,
    includeDrafts: env.CONTENT_INCLUDE_DRAFTS,
    cookieSecure: env.COOKIE_SECURE,
    rateLimits: DEFAULT_RATE_LIMITS,
    siteUrl: env.PUBLIC_SITE_URL.replace(/\/+$/, ''),
    mailFrom: env.MAIL_FROM,
    assistant: {
      model: env.GROQ_API_KEY ? new GroqModel(env.GROQ_API_KEY, env.ASSISTANT_MODEL) : null,
      timeoutMs: env.ASSISTANT_TIMEOUT_MS,
      userDaily: env.ASSISTANT_USER_DAILY,
      ipDaily: env.ASSISTANT_IP_DAILY,
      dailyTokens: env.ASSISTANT_DAILY_TOKENS,
      monthlyBudgetMicros: Math.round(env.ASSISTANT_MONTHLY_BUDGET_USD * 1_000_000),
      prices: { input: env.ASSISTANT_PRICE_INPUT_PER_M, output: env.ASSISTANT_PRICE_OUTPUT_PER_M },
    },
    now: () => new Date(),
  };
}
