import { describe, expect, it } from 'vitest';
import { computeMetrics, type EventRow } from './metrics';

const lessons = [
  { slug: 'cells', steps: ['a', 'b', 'c'] },
  { slug: 'sum', steps: ['x', 'y'] },
];

const ev = (
  name: string,
  anonId: string,
  sessionId: string,
  day: string,
  lessonSlug: string | null = null,
  stepSlug: string | null = null,
  locale: string | null = null,
): EventRow => ({ name, anonId, sessionId, day, lessonSlug, stepSlug, locale });

const events: EventRow[] = [
  // Visitor 1: finishes the first lesson on day 1, comes back on day 4.
  ev('lesson_start', 'v1', 's1', '2026-10-01', 'cells'),
  ev('step_correct', 'v1', 's1', '2026-10-01', 'cells', 'a'),
  ev('step_correct', 'v1', 's1', '2026-10-01', 'cells', 'b'),
  ev('step_correct', 'v1', 's1', '2026-10-01', 'cells', 'c'),
  ev('lesson_complete', 'v1', 's1', '2026-10-01', 'cells'),
  ev('lesson_start', 'v1', 's2', '2026-10-04', 'sum'),
  ev('step_correct', 'v1', 's2', '2026-10-04', 'sum', 'x'),
  // Visitor 2: starts, gets one step right, leaves; returns after 10 days (too late).
  ev('lesson_start', 'v2', 's3', '2026-10-01', 'cells'),
  ev('step_correct', 'v2', 's3', '2026-10-01', 'cells', 'a'),
  ev('step_incorrect', 'v2', 's3', '2026-10-01', 'cells', 'b'),
  ev('lesson_start', 'v2', 's4', '2026-10-11', 'cells'),
  // Visitor 3: signs up only, too recent for the 7-day return metric.
  ev('signup', 'v3', 's5', '2026-10-28', null, null, 'fr'),
  ev('signup', 'v3', 's5', '2026-10-29', null, null, 'en'),
];

describe('computeMetrics', () => {
  const m = computeMetrics(events, lessons, '2026-10-30');

  it('counts visitors by the language they used last; older events count as unknown', () => {
    expect(m.visitorsByLocale).toEqual({ unknown: 2, en: 1 });
  });

  it('counts visitors and activation on the first lesson', () => {
    expect(m.visitors).toBe(3);
    expect(m.activation).toEqual({ activated: 1, starters: 2, rate: 0.5 });
  });

  it('measures the 7-day return among visitors old enough', () => {
    expect(m.sevenDayReturn).toEqual({ returned: 1, eligible: 2, rate: 0.5 });
  });

  it('takes the median of correct steps per session', () => {
    // Sessions: s1=3, s2=1, s3=1, s4=0, s5=0 -> median 1.
    expect(m.medianStepsPerSession).toBe(1);
  });

  it('reports per-step drop-off for each lesson', () => {
    expect(m.dropOff[0]).toEqual({
      lesson: 'cells',
      starts: 3,
      steps: [
        { step: 'a', reached: 2, rate: 2 / 3 },
        { step: 'b', reached: 1, rate: 1 / 3 },
        { step: 'c', reached: 1, rate: 1 / 3 },
      ],
    });
    expect(m.dropOff[1]!.steps[1]).toEqual({ step: 'y', reached: 0, rate: 0 });
  });

  it('handles no events at all', () => {
    const empty = computeMetrics([], lessons, '2026-10-30');
    expect(empty.activation.rate).toBeNull();
    expect(empty.sevenDayReturn.rate).toBeNull();
    expect(empty.medianStepsPerSession).toBeNull();
    expect(computeMetrics(events.slice(0, 2), lessons, '2026-10-30').medianStepsPerSession).toBe(1);
  });
});
