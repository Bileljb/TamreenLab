// pnpm metrics:report — the launch metrics of PLAN §5 from anonymous usage events.
// Flags: --days=N limits the window (default 30).
import path from 'node:path';
import { loadCurriculum } from '@tamreen/content';
import { createPrisma } from '../src/lib/prisma';
import { dayKey, keyOfDate } from '../src/lib/day';
import { loadEnv } from '../src/lib/env';
import { computeMetrics } from '../src/lib/metrics';

const env = loadEnv();
const days = Number(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] ?? 30);
const today = dayKey(new Date(), env.DAY_UTC_OFFSET_MINUTES);
const since = new Date(Date.now() - days * 86_400_000);
const pct = (r: number | null) => (r === null ? '—' : `${(r * 100).toFixed(1)}%`);

const db = createPrisma();
try {
  const [rows, curriculum] = await Promise.all([
    db.analyticsEvent.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } }),
    loadCurriculum(path.resolve(import.meta.dirname, '../../../content')),
  ]);
  const lessons = curriculum.lessons.map((l) => ({
    slug: l.slug,
    steps: l.steps.map((s) => s.slug),
  }));
  const m = computeMetrics(
    rows.map((r) => ({ ...r, day: keyOfDate(r.day) })),
    lessons,
    today,
  );

  console.log(`metrics:report — last ${days} days up to ${today} (${rows.length} events)\n`);
  console.log(`Visitors:                    ${m.visitors}`);
  const byLocale = Object.entries(m.visitorsByLocale).map(([l, n]) => `${l} ${n}`);
  console.log(`  by language:               ${byLocale.join(', ') || '-'}`);
  console.log(
    `Activation (first lesson):   ${pct(m.activation.rate)}  (${m.activation.activated} of ${m.activation.starters} who started a lesson)`,
  );
  console.log(
    `7-day return:                ${pct(m.sevenDayReturn.rate)}  (${m.sevenDayReturn.returned} of ${m.sevenDayReturn.eligible} eligible)`,
  );
  console.log(`Median steps per session:    ${m.medianStepsPerSession ?? '—'}\n`);
  console.log('Step drop-off (share of sessions that started the lesson):');
  for (const lesson of m.dropOff) {
    if (lesson.starts === 0) continue;
    const steps = lesson.steps.map((s, i) => `${i + 1}:${pct(s.rate)}`).join('  ');
    console.log(
      `  ${lesson.lesson.padEnd(24)} starts ${String(lesson.starts).padStart(4)}  ${steps}`,
    );
  }
} finally {
  await db.$disconnect();
}
