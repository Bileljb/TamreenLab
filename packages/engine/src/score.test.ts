import { describe, expect, it } from 'vitest';
import { scoreAttempt, type ScoreInput } from './score';

const base: ScoreInput = {
  basePoints: 300,
  timeMs: 30_000,
  firstTry: false,
  hintUsed: false,
  answerShown: false,
};

describe('scoreAttempt', () => {
  it.each<[string, Partial<ScoreInput>, number]>([
    // Speed bonus: +50% of base under 10 s, falling linearly to 0 at 60 s.
    ['instant', { timeMs: 0 }, 450],
    ['at 10 s', { timeMs: 10_000 }, 450],
    ['at 35 s', { timeMs: 35_000 }, 375],
    ['at 60 s', { timeMs: 60_000 }, 300],
    ['very slow', { timeMs: 3_600_000 }, 300],
    // First-try bonus: +25% of base.
    ['first try, slow', { timeMs: 60_000, firstTry: true }, 375],
    ['first try, fast', { timeMs: 5_000, firstTry: true }, 525],
    // A hint halves the total; Show Answer gives nothing.
    ['hint', { timeMs: 60_000, hintUsed: true }, 150],
    ['hint, fast, first try', { timeMs: 0, firstTry: true, hintUsed: true }, 263],
    ['answer shown', { timeMs: 0, firstTry: true, answerShown: true }, 0],
    // Odd inputs never produce odd scores.
    ['negative time', { timeMs: -5 }, 450],
    ['NaN time', { timeMs: Number.NaN }, 300],
    ['other base', { basePoints: 100, timeMs: 60_000 }, 100],
  ])('%s', (_name, input, expected) => {
    expect(scoreAttempt({ ...base, ...input })).toBe(expected);
  });

  it('always returns a non-negative integer', () => {
    for (const timeMs of [0, 1234, 9999, 42_424, 99_999]) {
      const points = scoreAttempt({ ...base, basePoints: 333, timeMs, firstTry: true });
      expect(Number.isInteger(points)).toBe(true);
      expect(points).toBeGreaterThanOrEqual(0);
    }
  });
});
