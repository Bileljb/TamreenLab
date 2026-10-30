export type ScoreInput = {
  basePoints: number;
  /** Time from the step being shown to the correct answer. */
  timeMs: number;
  /** Correct on the first attempt. */
  firstTry: boolean;
  hintUsed: boolean;
  answerShown: boolean;
};

const FAST_MS = 10_000;
const SLOW_MS = 60_000;
const MAX_SPEED_BONUS = 0.5;
const FIRST_TRY_BONUS = 0.25;
const HINT_FACTOR = 0.5;

/** Speed bonus as a share of base points: the full bonus up to 10 s, then linear down to 0 at 60 s. */
function speedBonus(timeMs: number): number {
  if (Number.isNaN(timeMs)) return 0;
  const t = Math.max(0, timeMs);
  if (t <= FAST_MS) return MAX_SPEED_BONUS;
  if (t >= SLOW_MS) return 0;
  return (MAX_SPEED_BONUS * (SLOW_MS - t)) / (SLOW_MS - FAST_MS);
}

/**
 * Points for a correct answer (PLAN §3.5): base points, a capped speed bonus and a first-try
 * bonus; halved after a hint, zero after Show Answer. The player shows it, the API (Phase 4)
 * awards it.
 */
export function scoreAttempt(input: ScoreInput): number {
  if (input.answerShown) return 0;
  const multiplier = 1 + speedBonus(input.timeMs) + (input.firstTry ? FIRST_TRY_BONUS : 0);
  const points = input.basePoints * multiplier * (input.hintUsed ? HINT_FACTOR : 1);
  return Math.max(0, Math.round(points));
}
