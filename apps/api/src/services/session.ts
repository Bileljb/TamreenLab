import { randomUUID } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import type { Ctx } from '../context';
import { HttpError } from '../lib/errors';
import {
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  hashToken,
  newRefreshToken,
  signAccessToken,
} from '../lib/tokens';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../middleware/auth';

function cookieOptions(ctx: Ctx, path: string, maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: ctx.config.cookieSecure,
    path,
    maxAge: maxAgeSeconds * 1000,
  };
}

/** Signs in: a fresh access token and a refresh token, in the given family or a new one. */
export async function issueSession(
  ctx: Ctx,
  res: Response,
  userId: string,
  family: string = randomUUID(),
) {
  const now = ctx.config.now();
  const refresh = newRefreshToken();
  await ctx.db.refreshToken.create({
    data: {
      userId,
      family,
      tokenHash: hashToken(refresh),
      expiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000),
    },
  });
  res.cookie(
    ACCESS_COOKIE,
    await signAccessToken(userId, ctx.key, now),
    cookieOptions(ctx, '/', ACCESS_TTL_SECONDS),
  );
  res.cookie(REFRESH_COOKIE, refresh, cookieOptions(ctx, '/api/auth', REFRESH_TTL_SECONDS));
}

export function clearSession(ctx: Ctx, res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...cookieOptions(ctx, '/', 0), maxAge: undefined });
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(ctx, '/api/auth', 0), maxAge: undefined });
}

/**
 * Exchanges a refresh token for a new session (rotation). A token that was already used means it
 * leaked: the whole family is revoked and the user must sign in again.
 */
export async function rotateSession(ctx: Ctx, res: Response, token: string | undefined) {
  const now = ctx.config.now();
  const fail = (code: string) => {
    clearSession(ctx, res);
    return new HttpError(401, code, 'Session expired; sign in again');
  };
  if (!token) throw fail('NO_SESSION');
  const stored = await ctx.db.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!stored) throw fail('NO_SESSION');
  if (stored.revokedAt) {
    await ctx.db.refreshToken.updateMany({
      where: { family: stored.family, revokedAt: null },
      data: { revokedAt: now },
    });
    throw fail('REFRESH_REUSED');
  }
  if (stored.expiresAt <= now) throw fail('SESSION_EXPIRED');

  // Revoke only if still unrevoked, so two concurrent refreshes cannot both succeed.
  const { count } = await ctx.db.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: now },
  });
  if (count === 0) throw fail('REFRESH_REUSED');
  await issueSession(ctx, res, stored.userId, stored.family);
  return stored.userId;
}

export async function endSession(ctx: Ctx, res: Response, token: string | undefined) {
  if (token) {
    await ctx.db.refreshToken.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: ctx.config.now() },
    });
  }
  clearSession(ctx, res);
}
