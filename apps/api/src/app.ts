import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { errorHandler, notFound } from './middleware/errors';
import { healthRouter, type DbCheck } from './routes/health';

export type AppDeps = {
  logger: Logger;
  checkDb: DbCheck;
};

export function createApp({ logger, checkDb }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // requests arrive through the Next.js rewrite
  app.use(helmet());
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', healthRouter(checkDb));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
