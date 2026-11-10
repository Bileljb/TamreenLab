import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { PrismaClient } from './generated/prisma/client';
import type { AppConfig } from './config';
import { createContext, type MailDeps } from './context';
import { HttpError } from './lib/errors';
import { requestId } from './lib/logger';
import { authenticate, requireJson, requireProxy, requireSameSite } from './middleware/auth';
import { errorHandler, notFound } from './middleware/errors';
import { openApiDocument } from './openapi';
import { assistantRouter } from './routes/assistant';
import { attemptsRouter } from './routes/attempts';
import { authRouter } from './routes/auth';
import { clientErrorsRouter } from './routes/clientErrors';
import { emailRouter } from './routes/email';
import { eventsRouter } from './routes/events';
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
  /** Email for requests (password reset); without it those routes answer 503. */
  mail?: MailDeps;
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

export function createApp({ logger, checkDb, db, config, mail }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  // Requests arrive through the Next.js rewrite, which forwards X-Forwarded-For as it is (ADR 013).
  app.set('trust proxy', config?.trustProxy ?? 'loopback');
  app.use(helmet());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = requestId(req.headers['x-request-id']);
        res.setHeader('X-Request-Id', id);
        return id;
      },
    }),
  );
  // A public API (Render) serves only requests that came through the website (ADR 015).
  if (config?.proxySecret) app.use(requireProxy(config.proxySecret));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', healthRouter(checkDb));
  app.get('/api/docs', (_req, res) => {
    res.json(openApiDocument());
  });

  if (db && config) {
    const ctx = createContext(db, config, mail ?? null);
    const { rateLimits } = config;
    // Before the JSON-only guard: mail apps post one-click unsubscribes as forms (RFC 8058).
    app.use('/api/email', limiter(rateLimits.auth, 15 * 60_000));
    app.use('/api', emailRouter(ctx));
    app.use(
      '/api',
      requireJson,
      requireSameSite(config.siteUrl),
      authenticate(ctx),
      limiter(rateLimits.general, 60_000),
    );
    // The strict limit guards password guessing only; refresh and logout use the general limit.
    const authLimit = limiter(rateLimits.auth, 15 * 60_000);
    app.use('/api/auth/login', authLimit);
    app.use('/api/auth/register', authLimit);
    app.use('/api/auth/password', authLimit);
    app.use('/api/attempts', limiter(rateLimits.attempts, 60_000, 'user'));
    app.use('/api/assistant', limiter(rateLimits.assistant, 60_000, 'user'));
    app.use('/api/client-errors', limiter(10, 60_000));
    app.use('/api', clientErrorsRouter());
    for (const router of [
      authRouter,
      meRouter,
      lessonsRouter,
      attemptsRouter,
      assistantRouter,
      progressRouter,
      leaderboardRouter,
      eventsRouter,
    ]) {
      app.use('/api', router(ctx));
    }
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
