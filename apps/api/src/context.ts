import type { ContentLocale, EmailCopy } from '@tamreen/shared';
import type { PrismaClient } from './generated/prisma/client';
import type { AppConfig } from './config';
import { dayKey } from './lib/day';
import type { Mailer } from './lib/mailer';
import { accessKey } from './lib/tokens';

/** Sending email from a request: the transport and the text in each language. */
export type MailDeps = { mailer: Mailer; copy: Record<ContentLocale, EmailCopy> };

/** What every route needs: the database, the config, and a few derived helpers. */
export type Ctx = {
  db: PrismaClient;
  config: AppConfig;
  key: Uint8Array;
  today: () => string;
  /** Lesson statuses the API serves. */
  visibleStatuses: ('DRAFT' | 'PUBLISHED')[];
  /** Null when the app was built without mail (tests that need none). */
  mail: MailDeps | null;
};

export function createContext(
  db: PrismaClient,
  config: AppConfig,
  mail: MailDeps | null = null,
): Ctx {
  return {
    db,
    config,
    key: accessKey(config.jwtSecret),
    today: () => dayKey(config.now(), config.dayOffsetMinutes),
    visibleStatuses: config.includeDrafts ? ['DRAFT', 'PUBLISHED'] : ['PUBLISHED'],
    mail,
  };
}
