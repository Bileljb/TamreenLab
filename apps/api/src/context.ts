import type { PrismaClient } from './generated/prisma/client';
import type { AppConfig } from './config';
import { dayKey } from './lib/day';
import { accessKey } from './lib/tokens';

/** What every route needs: the database, the config, and a few derived helpers. */
export type Ctx = {
  db: PrismaClient;
  config: AppConfig;
  key: Uint8Array;
  today: () => string;
  /** Lesson statuses the API serves. */
  visibleStatuses: ('DRAFT' | 'PUBLISHED')[];
};

export function createContext(db: PrismaClient, config: AppConfig): Ctx {
  return {
    db,
    config,
    key: accessKey(config.jwtSecret),
    today: () => dayKey(config.now(), config.dayOffsetMinutes),
    visibleStatuses: config.includeDrafts ? ['DRAFT', 'PUBLISHED'] : ['PUBLISHED'],
  };
}
