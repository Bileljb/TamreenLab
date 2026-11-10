import { createApp } from './app';
import { configFromEnv } from './config';
import { loadEnv } from './lib/env';
import { createLogger } from './lib/logger';
import { prisma } from './lib/prisma';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);

const app = createApp({
  logger,
  db: prisma,
  config: configFromEnv(env),
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
