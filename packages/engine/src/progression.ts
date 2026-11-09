/**
 * Levels from total points (Phase 7, ADR 011). Each level takes 500 points more than the one
 * before: level 2 starts at 500, level 3 at 1500, level 4 at 3000. A first lesson (about 2000
 * points) reaches level 3, and later levels slow down without ever becoming out of reach.
 */
const STEP = 500;

/** Points at which a level starts. */
export function levelStart(level: number): number {
  return (STEP * level * (level - 1)) / 2;
}

export type Level = {
  level: number;
  /** Points earned inside this level. */
  into: number;
  /** Points this level takes from start to the next level. */
  span: number;
  /** 0–1, how far into the level. */
  progress: number;
};

export function levelFor(totalPoints: number): Level {
  const points = Math.max(0, Math.floor(totalPoints));
  // Largest n with STEP·n(n−1)/2 ≤ points.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * points) / STEP)) / 2));
  while (levelStart(level + 1) <= points) level++;
  while (level > 1 && levelStart(level) > points) level--;
  const into = points - levelStart(level);
  const span = levelStart(level + 1) - levelStart(level);
  return { level, into, span, progress: into / span };
}
