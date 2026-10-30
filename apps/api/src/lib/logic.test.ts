import { describe, expect, it } from 'vitest';
import { emptyGuestProgress } from '@tamreen/shared';
import { dayDate, dayKey, keyOfDate, previousDay } from './day';
import { planGuestMerge, type KnownStep } from './merge';
import { isAllowedDisplayName, normalizeName } from './moderation';
import { nextStreak, visibleStreak } from './streak';
import {
  accessKey,
  hashToken,
  newRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from './tokens';

describe('day', () => {
  it('uses the configured UTC offset', () => {
    const lateEvening = new Date('2026-10-30T22:30:00Z');
    expect(dayKey(lateEvening, 0)).toBe('2026-10-30');
    expect(dayKey(lateEvening, 180)).toBe('2026-10-31');
    expect(dayKey(new Date('2026-10-30T01:00:00Z'), -120)).toBe('2026-10-29');
  });

  it('converts to and from the stored date and steps back a day', () => {
    expect(keyOfDate(dayDate('2026-03-01'))).toBe('2026-03-01');
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2028-03-01')).toBe('2028-02-29');
  });
});

describe('streak', () => {
  it('starts, continues, holds within a day, and restarts after a gap', () => {
    let s = nextStreak(null, '2026-10-01');
    expect(s).toEqual({ current: 1, longest: 1, lastDay: '2026-10-01' });
    s = nextStreak(s, '2026-10-02');
    expect(s.current).toBe(2);
    expect(nextStreak(s, '2026-10-02')).toBe(s);
    s = nextStreak(s, '2026-10-05');
    expect(s).toEqual({ current: 1, longest: 2, lastDay: '2026-10-05' });
  });

  it('shows a streak only while it is still alive', () => {
    const s = { current: 4, longest: 6, lastDay: '2026-10-10' };
    expect(visibleStreak(s, '2026-10-10')).toBe(4);
    expect(visibleStreak(s, '2026-10-11')).toBe(4);
    expect(visibleStreak(s, '2026-10-12')).toBe(0);
    expect(visibleStreak(null, '2026-10-12')).toBe(0);
  });
});

describe('moderation', () => {
  it.each(['هدى', 'Sami 99', 'نور الهدى', 'Classmate'])('allows %s', (name) => {
    expect(isAllowedDisplayName(name)).toBe(true);
  });

  it.each(['admin', 'A d m i n', 'المُشرف', 'كلـــب', 'xX_fuck_Xx', '...'])('blocks %s', (name) => {
    expect(isAllowedDisplayName(name)).toBe(false);
  });

  it('normalises Arabic letter forms', () => {
    expect(normalizeName('أحمد  إبراهيم')).toBe(normalizeName('احمد ابراهيم'));
  });
});

describe('tokens', () => {
  const key = accessKey('test-secret-test-secret-test-secret!!');
  const now = new Date('2026-10-30T10:00:00Z');

  it('signs and verifies an access token for 15 minutes', async () => {
    const token = await signAccessToken('user-1', key, now);
    expect(await verifyAccessToken(token, key, now)).toBe('user-1');
    expect(await verifyAccessToken(token, key, new Date(now.getTime() + 14 * 60_000))).toBe(
      'user-1',
    );
    expect(await verifyAccessToken(token, key, new Date(now.getTime() + 16 * 60_000))).toBeNull();
  });

  it('rejects tokens signed with another key, tampered or missing', async () => {
    const token = await signAccessToken('user-1', key, now);
    expect(
      await verifyAccessToken(token, accessKey('another-secret-another-secret-xx'), now),
    ).toBeNull();
    expect(await verifyAccessToken(`${token}x`, key, now)).toBeNull();
    expect(await verifyAccessToken(undefined, key, now)).toBeNull();
  });

  it('makes random refresh tokens and stable hashes', () => {
    const a = newRefreshToken();
    expect(a).not.toBe(newRefreshToken());
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('planGuestMerge', () => {
  const steps: KnownStep[] = [
    { id: 's1', lessonSlug: 'cells', slug: 'a', basePoints: 300 },
    { id: 's2', lessonSlug: 'cells', slug: 'b', basePoints: 300 },
    { id: 's3', lessonSlug: 'sum', slug: 'a', basePoints: 500 },
  ];
  const guest = {
    ...emptyGuestProgress(),
    lessons: {
      cells: { stepsDone: ['a', 'b', 'a', 'unknown'], firstTry: ['a'], points: 9999 },
      sum: { stepsDone: ['a'], firstTry: [], points: 9999 },
      missing: { stepsDone: ['a'], firstTry: [], points: 1 },
    },
  };

  it('awards flat base points for new, known steps only', () => {
    const awards = planGuestMerge(guest, steps, new Set(['s2']));
    expect(awards.map((a) => [a.step.id, a.points, a.firstTry])).toEqual([
      ['s1', 300, true],
      ['s3', 500, false],
    ]);
  });

  it('caps the total but still merges the steps', () => {
    const awards = planGuestMerge(guest, steps, new Set(), 700);
    expect(awards.map((a) => a.points)).toEqual([300, 300, 100]);
    expect(planGuestMerge(guest, steps, new Set(), 0).every((a) => a.points === 0)).toBe(true);
  });
});
