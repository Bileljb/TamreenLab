import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { PrismaClient } from './generated/prisma/client';
import type { AppConfig } from './config';
import { createContext } from './context';
import { HttpError } from './lib/errors';
import { authenticate, requireJson } from './middleware/auth';
import { errorHandler, notFound } from './middleware/errors';
import { openApiDocument } from './openapi';
import { attemptsRouter } from './routes/attempts';
import { authRouter } from './routes/auth';
import { healthRouter, type DbCheck } from './routes/health';
import { leaderboardRouter } from './routes/leaderboard';
import { lessonsRouter } from './routes/lessons';
import { meRouter } from './routes/me';
import { progressRouter } from './routes/progress';

export type AppDeps = {
  logger: Logger;
  checkDb: DbCheck;
  /** Optional so the health-only tests need no database. */
  db?: PrismaClient;
  config?: AppConfig;
};

function limiter(limit: number, windowMs: number, key?: 'user'): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(key === 'user'
      ? { keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip ?? '') }
      : {}),
    handler: (_req, _res, next) =>
      next(new HttpError(429, 'RATE_LIMITED', 'Too many requests; try again shortly')),
  });
}

export function createApp({ logger, checkDb, db, config }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // requests arrive through the Next.js rewrite
  app.use(helmet());
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', healthRouter(checkDb));
  app.get('/api/docs', (_req, res) => {
    res.json(openApiDocument());
  });

  if (db && config) {
    const ctx = createContext(db, config);
    const { rateLimits } = config;
    app.use('/api', requireJson, authenticate(ctx), limiter(rateLimits.general, 60_000));
    app.use('/api/auth', limiter(rateLimits.auth, 15 * 60_000));
    app.use('/api/attempts', limiter(rateLimits.attempts, 60_000, 'user'));
    for (const router of [
      authRouter,
      meRouter,
      lessonsRouter,
      attemptsRouter,
      progressRouter,
      leaderboardRouter,
    ]) {
      app.use('/api', router(ctx));
    }
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
