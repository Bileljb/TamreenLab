import { Router } from 'express';
import { z } from 'zod';
import type { Ctx } from '../context';
import { HttpError } from '../lib/errors';
import { stepFromRow } from '../services/steps';

const ListQuery = z.object({ track: z.string().max(80).optional() });
const SlugParam = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/) });

export function lessonsRouter(ctx: Ctx) {
  const router = Router();
  const visible = { status: { in: ctx.visibleStatuses } };

  router.get('/tracks', async (_req, res) => {
    const tracks = await ctx.db.track.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { lessons: { where: visible } } } },
    });
    res.json(
      tracks.map((t) => ({
        slug: t.slug,
        titleAr: t.titleAr,
        order: t.order,
        lessonCount: t._count.lessons,
      })),
    );
  });

  router.get('/lessons', async (req, res) => {
    const { track } = ListQuery.parse(req.query);
    const lessons = await ctx.db.lesson.findMany({
      where: { ...visible, ...(track ? { track: { slug: track } } : {}) },
      orderBy: { order: 'asc' },
      include: { track: { select: { slug: true } }, _count: { select: { steps: true } } },
    });
    res.json(
      lessons.map((l) => ({
        slug: l.slug,
        track: l.track.slug,
        order: l.order,
        kind: l.kind,
        status: l.status,
        titleAr: l.titleAr,
        summaryAr: l.summaryAr,
        minutes: l.minutes,
        stepCount: l._count.steps,
      })),
    );
  });

  router.get('/lessons/:slug', async (req, res) => {
    const { slug } = SlugParam.parse(req.params);
    const lesson = await ctx.db.lesson.findFirst({
      where: { slug, ...visible },
      include: { track: { select: { slug: true } }, steps: { orderBy: { order: 'asc' } } },
    });
    if (!lesson) throw new HttpError(404, 'LESSON_NOT_FOUND', 'No such lesson');
    res.json({
      slug: lesson.slug,
      track: lesson.track.slug,
      order: lesson.order,
      kind: lesson.kind,
      status: lesson.status,
      titleAr: lesson.titleAr,
      summaryAr: lesson.summaryAr,
      minutes: lesson.minutes,
      steps: lesson.steps.map((row) => stepFromRow(row)),
    });
  });

  return router;
}
