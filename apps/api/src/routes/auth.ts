import { Router } from 'express';
import { hash, verify } from '@node-rs/argon2';
import { LoginRequestSchema, RegisterRequestSchema } from '@tamreen/shared';
import type { Ctx } from '../context';
import { HttpError } from '../lib/errors';
import { isAllowedDisplayName } from '../lib/moderation';
import { REFRESH_COOKIE } from '../middleware/auth';
import { endSession, issueSession, rotateSession } from '../services/session';
import { toUserDto } from './me';

// Verified against when the email is unknown, so both paths take the same time.
const DUMMY_HASH = hash('not-a-real-password-just-for-timing');

export function authRouter(ctx: Ctx) {
  const router = Router();

  router.post('/auth/register', async (req, res) => {
    const body = RegisterRequestSchema.parse(req.body);
    if (!isAllowedDisplayName(body.displayName)) {
      throw new HttpError(400, 'DISPLAY_NAME_NOT_ALLOWED', 'Choose another display name');
    }
    if (await ctx.db.user.findUnique({ where: { email: body.email } })) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    const user = await ctx.db.user.create({
      data: {
        email: body.email,
        displayName: body.displayName,
        passwordHash: await hash(body.password),
      },
    });
    await issueSession(ctx, res, user.id);
    res.status(201).json(toUserDto(user));
  });

  router.post('/auth/login', async (req, res) => {
    const body = LoginRequestSchema.parse(req.body);
    const user = await ctx.db.user.findUnique({ where: { email: body.email } });
    const ok = await verify(user?.passwordHash ?? (await DUMMY_HASH), body.password);
    if (!user || !ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Wrong email or password');
    await issueSession(ctx, res, user.id);
    res.json(toUserDto(user));
  });

  router.post('/auth/refresh', async (req, res) => {
    const userId = await rotateSession(
      ctx,
      res,
      req.cookies?.[REFRESH_COOKIE] as string | undefined,
    );
    const user = await ctx.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(401, 'NO_SESSION', 'Sign in again');
    res.json(toUserDto(user));
  });

  router.post('/auth/logout', async (req, res) => {
    await endSession(ctx, res, req.cookies?.[REFRESH_COOKIE] as string | undefined);
    res.status(204).end();
  });

  return router;
}
