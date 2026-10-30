// pnpm content:sync — makes Postgres match the content files. Idempotent: a second run changes nothing.
// Flags: --dry-run prints the plan without writing.
import path from 'node:path';
import {
  desiredState,
  loadCurriculum,
  planSync,
  summarize,
  type DbState,
  type SyncPlan,
} from '@tamreen/content';
import { Prisma } from '../src/generated/prisma/client';
import { createPrisma } from '../src/lib/prisma';

type Db = ReturnType<typeof createPrisma>;
type Tx = Prisma.TransactionClient;

const ORDER_BUMP = 100_000;

async function readState(db: Db): Promise<DbState> {
  const [tracks, lessons, steps] = await Promise.all([
    db.track.findMany({ select: { slug: true, titleAr: true, order: true } }),
    db.lesson.findMany({
      include: { track: { select: { slug: true } }, _count: { select: { progress: true } } },
    }),
    db.step.findMany({
      include: { lesson: { select: { slug: true } }, _count: { select: { attempts: true } } },
    }),
  ]);
  const inUse = new Set(lessons.filter((l) => l._count.progress > 0).map((l) => l.slug));
  for (const s of steps) if (s._count.attempts > 0) inUse.add(s.lesson.slug);
  return {
    tracks,
    lessons: lessons.map((l) => ({
      slug: l.slug,
      trackSlug: l.track.slug,
      order: l.order,
      kind: l.kind,
      titleAr: l.titleAr,
      summaryAr: l.summaryAr,
      minutes: l.minutes,
      status: l.status,
      seoJson: l.seoJson,
    })),
    steps: steps.map((s) => ({
      lessonSlug: s.lesson.slug,
      slug: s.slug,
      order: s.order,
      type: s.type,
      promptAr: s.promptAr,
      sheetJson: s.sheetJson,
      checkJson: s.checkJson,
      hintAr: s.hintAr,
      explainAr: s.explainAr,
      basePoints: s.basePoints,
      attempts: s._count.attempts,
    })),
    lessonsInUse: [...inUse],
  };
}

const json = (value: unknown) =>
  value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

async function apply(tx: Tx, plan: SyncPlan, desired: ReturnType<typeof desiredState>) {
  // Deletes first, children before parents.
  for (const op of plan.ops) {
    if (op.kind === 'deleteStep') {
      await tx.step.deleteMany({ where: { slug: op.slug, lesson: { slug: op.lessonSlug } } });
    }
  }
  for (const op of plan.ops) {
    if (op.kind === 'deleteLesson') {
      await tx.step.deleteMany({ where: { lesson: { slug: op.slug } } });
      await tx.lesson.delete({ where: { slug: op.slug } });
    }
  }

  for (const op of plan.ops) {
    if (op.kind === 'createTrack' || op.kind === 'updateTrack') {
      const { slug, ...data } = op.row;
      await tx.track.upsert({ where: { slug }, create: op.row, update: data });
    }
  }
  const trackIds = new Map((await tx.track.findMany()).map((t) => [t.slug, t.id]));

  for (const op of plan.ops) {
    if (op.kind === 'createLesson' || op.kind === 'updateLesson') {
      const { slug, trackSlug, seoJson, ...rest } = op.row;
      const data = { ...rest, trackId: trackIds.get(trackSlug)!, seoJson: json(seoJson) };
      await tx.lesson.upsert({ where: { slug }, create: { slug, ...data }, update: data });
    }
  }
  const lessonIds = new Map((await tx.lesson.findMany()).map((l) => [l.slug, l.id]));

  // Steps: in every lesson a step op touches, move the old orders out of the way first so the
  // (lessonId, order) unique index never collides mid-reorder, then write every step of it.
  const touched = new Set(
    plan.ops.flatMap((op) =>
      op.kind === 'createStep' || op.kind === 'updateStep' ? [op.row.lessonSlug] : [],
    ),
  );
  for (const lessonSlug of touched) {
    const lessonId = lessonIds.get(lessonSlug)!;
    await tx.step.updateMany({ where: { lessonId }, data: { order: { increment: ORDER_BUMP } } });
    for (const row of desired.steps.filter((s) => s.lessonSlug === lessonSlug)) {
      const { slug, order, type, promptAr, hintAr, explainAr, basePoints } = row;
      const data = {
        order,
        type,
        promptAr,
        hintAr,
        explainAr,
        basePoints,
        sheetJson: json(row.sheetJson),
        checkJson: json(row.checkJson),
      };
      await tx.step.upsert({
        where: { lessonId_slug: { lessonId, slug } },
        create: { lessonId, slug, ...data },
        update: data,
      });
    }
  }

  for (const op of plan.ops) {
    if (op.kind === 'deleteTrack') await tx.track.delete({ where: { slug: op.slug } });
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const contentDir =
    process.env.CONTENT_DIR ?? path.resolve(import.meta.dirname, '../../../content');
  const curriculum = await loadCurriculum(contentDir);
  const desired = desiredState(curriculum.tracks, curriculum.lessons);
  const db = createPrisma();
  try {
    const plan = planSync(desired, await readState(db));
    for (const error of plan.errors) console.error(`error: ${error}`);
    if (plan.errors.length) {
      process.exitCode = 1;
      return;
    }
    const counts = Object.entries(summarize(plan)).filter(([, n]) => n > 0);
    if (counts.length === 0) {
      console.log('content:sync: 0 changes (database matches content)');
      return;
    }
    console.log(`content:sync: ${counts.map(([k, n]) => `${k} ${n}`).join(', ')}`);
    if (dryRun) {
      console.log('dry run: nothing written');
      return;
    }
    await db.$transaction((tx) => apply(tx, plan, desired), { timeout: 60_000 });
    console.log(`content:sync: applied ${plan.ops.length} changes`);
  } finally {
    await db.$disconnect();
  }
}

await main();
