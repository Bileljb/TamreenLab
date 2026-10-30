import { describe, expect, it } from 'vitest';
import { GUEST_PROGRESS_KEY, emptyGuestProgress } from '@tamreen/shared';
import { completeLesson, loadGuestProgress, recordStep, saveGuestProgress } from './guestProgress';

describe('guest progress', () => {
  it('records steps once and adds their points', () => {
    let p = recordStep(emptyGuestProgress(), 'sum-basics', 'a', 450, true);
    p = recordStep(p, 'sum-basics', 'b', 300.4, false);
    p = recordStep(p, 'sum-basics', 'a', 999, true);
    expect(p.lessons['sum-basics']).toEqual({
      stepsDone: ['a', 'b'],
      firstTry: ['a'],
      points: 750,
    });
  });

  it('marks a lesson complete once', () => {
    const first = completeLesson(emptyGuestProgress(), 'x', new Date('2026-10-30T10:00:00Z'));
    expect(first.lessons.x!.completedAt).toBe('2026-10-30T10:00:00.000Z');
    expect(completeLesson(first, 'x', new Date('2027-01-01T00:00:00Z'))).toBe(first);
  });

  it('round-trips through localStorage under the versioned key', () => {
    const p = recordStep(emptyGuestProgress(), 'l', 's', 10, false);
    saveGuestProgress(p);
    expect(JSON.parse(window.localStorage.getItem(GUEST_PROGRESS_KEY)!)).toEqual(p);
    expect(loadGuestProgress()).toEqual(p);
  });

  it('treats missing, corrupt or wrong-version data as empty', () => {
    expect(loadGuestProgress()).toEqual(emptyGuestProgress());
    window.localStorage.setItem(GUEST_PROGRESS_KEY, '{not json');
    expect(loadGuestProgress()).toEqual(emptyGuestProgress());
    window.localStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify({ version: 9 }));
    expect(loadGuestProgress()).toEqual(emptyGuestProgress());
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    } as unknown as Storage;
    expect(loadGuestProgress(broken)).toEqual(emptyGuestProgress());
    expect(() => saveGuestProgress(emptyGuestProgress(), broken)).not.toThrow();
  });
});
