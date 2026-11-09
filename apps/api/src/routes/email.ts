import express, { Router } from 'express';
import { UnsubscribeRequestSchema } from '@tamreen/shared';
import type { Ctx } from '../context';
import { HttpError } from '../lib/errors';
import { verifyUnsubscribeToken } from '../lib/unsubscribe';

/**
 * `POST /api/email/unsubscribe?u=…&t=…` turns weekly reminders off. It needs no session: the
 * signed token proves the link came from our email. Mail apps send one-click unsubscribes
 * (RFC 8058) as a form post, so this route is mounted before the JSON-only guard; it reads no
 * cookies and changes one flag, so cross-site posts gain nothing.
 */
export function emailRouter(ctx: Ctx) {
  const router = Router();
  router.post(
    '/email/unsubscribe',
    express.urlencoded({ extended: false, limit: '2kb' }),
    async (req, res) => {
      const { u, t } = UnsubscribeRequestSchema.parse({
        u: req.query.u ?? req.body?.u,
        t: req.query.t ?? req.body?.t,
      });
      if (!verifyUnsubscribeToken(u, t, ctx.config.jwtSecret)) {
        throw new HttpError(400, 'INVALID_LINK', 'This unsubscribe link is not valid');
      }
      // Idempotent: a second click, or a deleted account, is still a success.
      await ctx.db.user.updateMany({
        where: { id: u },
        data: { emailOptIn: false, emailOptInAt: null },
      });
      res.json({ unsubscribed: true });
    },
  );
  return router;
}
