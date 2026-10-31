import type { DayKey } from './day';

export type EventRow = {
  name: string;
  anonId: string;
  sessionId: string;
  lessonSlug: string | null;
  stepSlug: string | null;
  day: DayKey;
  /** The page language; null on events recorded before languages existed. */
  locale: string | null;
};

export type LessonOutline = { slug: string; steps: string[] };

export type Metrics = {
  visitors: number;
  /** Visitors by the language of their latest event (`unknown` before languages existed). */
  visitorsByLocale: Record<string, number>;
  /** Visitors who completed the first lesson, as a share of visitors who started any lesson. */
  activation: { activated: number; starters: number; rate: number | null };
  /** Of visitors first seen at least 7 days ago, the share seen again within 7 days. */
  sevenDayReturn: { returned: number; eligible: number; rate: number | null };
  medianStepsPerSession: number | null;
  /** Per lesson: sessions that started it, then the share reaching each step. */
  dropOff: {
    lesson: string;
    starts: number;
    steps: { step: string; reached: number; rate: number }[];
  }[];
};

const rate = (part: number, whole: number) => (whole === 0 ? null : part / whole);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** `n` days after a day key. */
function addDays(day: DayKey, n: number): DayKey {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** The launch metrics of PLAN §5, from anonymous events. Pure, so it is unit-tested. */
export function computeMetrics(
  events: EventRow[],
  lessons: LessonOutline[],
  today: DayKey,
): Metrics {
  const visitors = new Set(events.map((e) => e.anonId));
  const first = lessons[0]?.slug;
  const starters = new Set(events.filter((e) => e.name === 'lesson_start').map((e) => e.anonId));
  const activated = new Set(
    events
      .filter((e) => e.name === 'lesson_complete' && e.lessonSlug === first)
      .map((e) => e.anonId),
  );

  const daysByVisitor = new Map<string, Set<DayKey>>();
  for (const e of events) {
    const days = daysByVisitor.get(e.anonId) ?? new Set<DayKey>();
    days.add(e.day);
    daysByVisitor.set(e.anonId, days);
  }
  const cutoff = addDays(today, -7);
  let eligible = 0;
  let returned = 0;
  for (const days of daysByVisitor.values()) {
    const sorted = [...days].sort();
    const firstDay = sorted[0]!;
    if (firstDay > cutoff) continue; // not 7 days old yet
    eligible++;
    const last = addDays(firstDay, 7);
    if (sorted.some((d) => d > firstDay && d <= last)) returned++;
  }

  // Events arrive in time order; the latest day wins.
  const lastLocale = new Map<string, { day: DayKey; locale: string }>();
  for (const e of events) {
    const seen = lastLocale.get(e.anonId);
    if (!seen || e.day >= seen.day) lastLocale.set(e.anonId, { day: e.day, locale: e.locale ?? 'unknown' });
  }
  const visitorsByLocale: Record<string, number> = {};
  for (const { locale } of lastLocale.values()) visitorsByLocale[locale] = (visitorsByLocale[locale] ?? 0) + 1;

  const stepsPerSession = new Map<string, number>();
  for (const e of events) {
    if (!stepsPerSession.has(e.sessionId)) stepsPerSession.set(e.sessionId, 0);
    if (e.name === 'step_correct')
      stepsPerSession.set(e.sessionId, stepsPerSession.get(e.sessionId)! + 1);
  }

  const dropOff = lessons.map((lesson) => {
    const startSessions = new Set(
      events
        .filter((e) => e.name === 'lesson_start' && e.lessonSlug === lesson.slug)
        .map((e) => e.sessionId),
    );
    const steps = lesson.steps.map((step) => {
      const reached = new Set(
        events
          .filter(
            (e) =>
              e.name === 'step_correct' &&
              e.lessonSlug === lesson.slug &&
              e.stepSlug === step &&
              startSessions.has(e.sessionId),
          )
          .map((e) => e.sessionId),
      ).size;
      return { step, reached, rate: rate(reached, startSessions.size) ?? 0 };
    });
    return { lesson: lesson.slug, starts: startSessions.size, steps };
  });

  return {
    visitors: visitors.size,
    visitorsByLocale,
    activation: {
      activated: activated.size,
      starters: starters.size,
      rate: rate(activated.size, starters.size),
    },
    sevenDayReturn: { returned, eligible, rate: rate(returned, eligible) },
    medianStepsPerSession: median([...stepsPerSession.values()]),
    dropOff,
  };
}
