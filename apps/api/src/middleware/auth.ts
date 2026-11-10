import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const PROXY_HEADER = 'x-tamreen-proxy';
export const CLIENT_IP_HEADER = 'x-tamreen-client-ip';

/**
 * For an API with a public address (ADR 015): only the web server knows the secret, so a request
 * without it did not come through the site and is refused. The web server also sends the visitor's
 * IP, which then replaces `req.ip` for rate limits and quotas. The host's health check is exempt.
 */
export function requireProxy(secret: string): RequestHandler {
  const expected = Buffer.from(secret);
  return (req, _res, next) => {
    if (req.method === 'GET' && req.path === '/api/health') return next();
    const given = Buffer.from(String(req.headers[PROXY_HEADER] ?? ''));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new HttpError(403, 'NOT_VIA_SITE', 'Use the website');
    }
    const ip = String(req.headers[CLIENT_IP_HEADER] ?? '').trim();
    if (isIP(ip)) Object.defineProperty(req, 'ip', { value: ip, configurable: true });
    next();
  };
}

/**
 * CSRF, second layer (ADR 013): a browser names the page that sent a request (`Origin`, and
 * `Sec-Fetch-Site` in current browsers). State changes from any other site are refused. Requests
 * without either header come from non-browser clients, which carry no victim's cookies.
 */
export function requireSameSite(siteUrl: string): RequestHandler {
  const site = new URL(siteUrl).origin;
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.headers.origin;
    const fetchSite = req.headers['sec-fetch-site'];
    if ((origin && origin !== site) || fetchSite === 'cross-site') {
      throw new HttpError(403, 'CROSS_SITE', 'Cross-site requests are not allowed');
    }
    next();
  };
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
