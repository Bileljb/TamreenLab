import path from 'node:path';
import { loadEmailCopy } from '@tamreen/content';
import { CONTENT_LOCALES, type ContentLocale, type EmailCopy } from '@tamreen/shared';
import { createApp } from './app';
import { configFromEnv } from './config';
import { loadEnv } from './lib/env';
import { createLogger } from './lib/logger';
import { LogMailer } from './lib/mailer';
import { prisma } from './lib/prisma';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
// src/ and dist/ sit at the same depth, so this finds the repo's content folder from both.
const contentDir = process.env.CONTENT_DIR ?? path.resolve(import.meta.dirname, '../../../content');
const copy = {} as Record<ContentLocale, EmailCopy>;
for (const locale of CONTENT_LOCALES) copy[locale] = await loadEmailCopy(contentDir, locale);

const app = createApp({
  logger,
  db: prisma,
  config: configFromEnv(env),
  // Only the log transport exists until the developer picks a provider (ADR 011).
  mail: { mailer: new LogMailer(logger), copy },
  checkDb: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
});

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(`api listening on http://${env.HOST}:${env.PORT}`);
});

function shutdown() {
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}
// Errors outside a request still reach the logs; a crash exits so the host restarts the process.
process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  process.exit(1);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
