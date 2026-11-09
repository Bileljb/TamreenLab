import { addDays, previousDay, type DayKey } from './day';

export type StreakState = {
  current: number;
  longest: number;
  lastDay: DayKey | null;
  /** The last day a streak freeze covered (ADR 011). */
  freezeUsedOn?: DayKey | null;
};

export type StreakOptions = { freeze?: boolean };

/** A freeze covers one missed day, at most once in any seven days. */
export const FREEZE_EVERY_DAYS = 7;

/** Whether a freeze could cover yesterday, seen from `today`. */
export function freezeAvailable(state: StreakState, today: DayKey): boolean {
  if (!state.freezeUsedOn) return true;
  return addDays(state.freezeUsedOn, FREEZE_EVERY_DAYS) <= previousDay(today);
}

/** True when the only gap is yesterday and the learner's freeze can cover it. */
function frozenGap(s: StreakState, today: DayKey, options: StreakOptions): boolean {
  return (
    !!options.freeze &&
    s.lastDay === previousDay(previousDay(today)) &&
    s.current > 0 &&
    freezeAvailable(s, today)
  );
}

/** The streak after the learner earns points on `today`. */
export function nextStreak(
  state: StreakState | null,
  today: DayKey,
  options: StreakOptions = {},
): StreakState {
  const s: StreakState = state ?? { current: 0, longest: 0, lastDay: null };
  if (s.lastDay === today) return s;
  if (frozenGap(s, today, options)) {
    const current = s.current + 1;
    return {
      current,
      longest: Math.max(s.longest, current),
      lastDay: today,
      freezeUsedOn: previousDay(today),
    };
  }
  const current = s.lastDay === previousDay(today) ? s.current + 1 : 1;
  return { ...s, current, longest: Math.max(s.longest, current), lastDay: today };
}

/**
 * The streak as shown on a given day: it is broken if the last active day is before yesterday,
 * unless a freeze still covers yesterday.
 */
export function visibleStreak(
  state: StreakState | null,
  today: DayKey,
  options: StreakOptions = {},
): number {
  if (!state?.lastDay) return 0;
  if (state.lastDay === today || state.lastDay === previousDay(today)) return state.current;
  return frozenGap(state, today, options) ? state.current : 0;
}
