'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  GUEST_PROGRESS_KEY,
  GuestProgressSchema,
  emptyGuestProgress,
  type GuestProgress,
  type LessonProgress,
} from '@tamreen/shared';

/** Reads guest progress. Missing, corrupt or blocked storage all mean "no progress yet". */
export function loadGuestProgress(
  storage: Storage | undefined = globalThis.localStorage,
): GuestProgress {
  try {
    const raw = storage?.getItem(GUEST_PROGRESS_KEY);
    if (!raw) return emptyGuestProgress();
    const parsed = GuestProgressSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyGuestProgress();
  } catch {
    return emptyGuestProgress();
  }
}

export function saveGuestProgress(
  progress: GuestProgress,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(GUEST_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Private mode or a full quota: progress just isn't kept.
  }
}

const emptyLesson = (): LessonProgress => ({ stepsDone: [], firstTry: [], points: 0 });

/** Adds a correctly answered step. A step already done earns nothing again. */
export function recordStep(
  progress: GuestProgress,
  lesson: string,
  step: string,
  points: number,
  firstTry: boolean,
): GuestProgress {
  const current = progress.lessons[lesson] ?? emptyLesson();
  if (current.stepsDone.includes(step)) return progress;
  const next: LessonProgress = {
    ...current,
    stepsDone: [...current.stepsDone, step],
    firstTry: firstTry ? [...current.firstTry, step] : current.firstTry,
    points: current.points + Math.max(0, Math.round(points)),
  };
  return { ...progress, lessons: { ...progress.lessons, [lesson]: next } };
}

export function completeLesson(progress: GuestProgress, lesson: string, at: Date): GuestProgress {
  const current = progress.lessons[lesson] ?? emptyLesson();
  if (current.completedAt) return progress;
  return {
    ...progress,
    lessons: { ...progress.lessons, [lesson]: { ...current, completedAt: at.toISOString() } },
  };
}

/** Guest progress for one lesson. `null` until it has been read on the client (no SSR mismatch). */
export function useLessonProgress(lesson: string) {
  const [progress, setProgress] = useState<LessonProgress | null>(null);

  useEffect(() => {
    setProgress(loadGuestProgress().lessons[lesson] ?? emptyLesson());
  }, [lesson]);

  const update = useCallback(
    (change: (all: GuestProgress) => GuestProgress) => {
      // Re-read first: another tab may have written since.
      const next = change(loadGuestProgress());
      saveGuestProgress(next);
      setProgress(next.lessons[lesson] ?? emptyLesson());
    },
    [lesson],
  );

  return {
    progress,
    recordStep: (step: string, points: number, firstTry: boolean) =>
      update((all) => recordStep(all, lesson, step, points, firstTry)),
    complete: () => update((all) => completeLesson(all, lesson, new Date())),
  };
}
