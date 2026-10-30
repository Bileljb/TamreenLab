import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Ctx } from '../context';
import { HttpError } from '../lib/errors';
import { verifyAccessToken } from '../lib/tokens';

export const ACCESS_COOKIE = 'tamreen_at';
export const REFRESH_COOKIE = 'tamreen_rt';
/** Not a secret: tells the browser a session may exist, so guests never call /auth/refresh. */
export const SESSION_HINT_COOKIE = 'tamreen_session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express's own extension point
  namespace Express {
    interface Request {
      /** Set by `authenticate` when the request carries a valid access token. */
      userId?: string;
    }
  }
}

/** Reads the access-token cookie. Never fails: a guest is simply a request without `userId`. */
export function authenticate(ctx: Ctx): RequestHandler {
  return async (req, _res, next) => {
    const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    const userId = await verifyAccessToken(token, ctx.key, ctx.config.now());
    if (userId) req.userId = userId;
    next();
  };
}

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.userId) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in first');
  next();
};

export function userId(req: Request): string {
  if (!req.userId) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in first');
  return req.userId;
}

/**
 * State-changing requests must be JSON. A cross-site HTML form cannot send that content type
 * without a CORS preflight, which this API never allows: a basic CSRF guard (Phase 9 hardens it).
 */
export function requireJson(req: Request, _res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  // A bodiless DELETE cannot come from an HTML form, so it needs no content type.
  const hasBody =
    Boolean(req.headers['content-length'] && req.headers['content-length'] !== '0') ||
    Boolean(req.headers['transfer-encoding']);
  if (req.method === 'DELETE' && !hasBody) return next();
  if (!req.is('application/json')) {
    throw new HttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Send JSON with Content-Type: application/json',
    );
  }
  next();
}
