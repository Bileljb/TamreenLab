import { Router } from 'express';
import { AnalyticsEventSchema } from '@tamreen/shared';
import type { Ctx } from '../context';
import { dayDate } from '../lib/day';

export function eventsRouter(ctx: Ctx) {
  const router = Router();

  /** Records one anonymous usage event (ADR 007). No user id and no IP address are stored. */
  router.post('/events', async (req, res) => {
    const event = AnalyticsEventSchema.parse(req.body);
    await ctx.db.analyticsEvent.create({ data: { ...event, day: dayDate(ctx.today()) } });
    res.status(204).end();
  });

  return router;
}
