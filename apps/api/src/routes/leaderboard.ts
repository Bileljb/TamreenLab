import { Router } from 'express';
import { z } from 'zod';
import type { Leaderboard } from '@tamreen/shared';
import type { Ctx } from '../context';
import { dayDate } from '../lib/day';

const Query = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) });

export function leaderboardRouter(ctx: Ctx) {
  const router = Router();

  /** Today's points per user, from the ledger. Public; `isMe` marks the signed-in user. */
  router.get('/leaderboard/daily', async (req, res) => {
    const { limit } = Query.parse(req.query);
    const day = ctx.today();
    const rows = await ctx.db.pointEvent.groupBy({
      by: ['userId'],
      where: { day: dayDate(day) },
      _sum: { delta: true },
      having: { delta: { _sum: { gt: 0 } } },
      orderBy: [{ _sum: { delta: 'desc' } }, { userId: 'asc' }],
      take: limit,
    });
    const users = await ctx.db.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, displayName: true },
    });
    const names = new Map(users.map((u) => [u.id, u.displayName]));
    const body: Leaderboard = {
      day,
      entries: rows.map((r, i) => ({
        rank: i + 1,
        displayName: names.get(r.userId) ?? '',
        points: r._sum.delta ?? 0,
        isMe: r.userId === req.userId,
      })),
    };
    res.json(body);
  });

  return router;
}
