import { pino } from 'pino';
import { createApp } from './app';
import { loadEnv } from './lib/env';
import { prisma } from './lib/prisma';

const env = loadEnv();
const logger = pino({ level: env.LOG_LEVEL });

const app = createApp({
  logger,
  checkDb: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
});

const server = app.listen(env.PORT, () => {
  logger.info(`api listening on http://localhost:${env.PORT}`);
});

function shutdown() {
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
