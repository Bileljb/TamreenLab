import { describe, expect, it } from 'vitest';
import { levelFor, levelStart } from './progression';

describe('levelStart', () => {
  it('needs 500 more points for each level than for the one before', () => {
    expect([1, 2, 3, 4, 5, 6].map(levelStart)).toEqual([0, 500, 1500, 3000, 5000, 7500]);
  });
});

describe('levelFor', () => {
  it.each([
    [0, 1, 0, 500],
    [499, 1, 499, 500],
    [500, 2, 0, 1000],
    [1499, 2, 999, 1000],
    [1500, 3, 0, 1500],
    [7600, 6, 100, 3000],
  ])('%i points -> level %i, %i into a %i-point level', (points, level, into, span) => {
    const l = levelFor(points);
    expect(l).toMatchObject({ level, into, span });
    expect(l.progress).toBeCloseTo(into / span);
  });

  it('treats negative or fractional totals safely', () => {
    expect(levelFor(-20).level).toBe(1);
    expect(levelFor(500.7).level).toBe(2);
  });
});
