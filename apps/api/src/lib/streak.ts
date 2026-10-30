import { previousDay, type DayKey } from './day';

export type StreakState = { current: number; longest: number; lastDay: DayKey | null };

/** The streak after the learner earns points on `today`. */
export function nextStreak(state: StreakState | null, today: DayKey): StreakState {
  const s = state ?? { current: 0, longest: 0, lastDay: null };
  if (s.lastDay === today) return s;
  const current = s.lastDay === previousDay(today) ? s.current + 1 : 1;
  return { current, longest: Math.max(s.longest, current), lastDay: today };
}

/** The streak as shown on a given day: it is broken if the last active day is before yesterday. */
export function visibleStreak(state: StreakState | null, today: DayKey): number {
  if (!state?.lastDay) return 0;
  return state.lastDay === today || state.lastDay === previousDay(today) ? state.current : 0;
}
