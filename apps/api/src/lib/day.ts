/**
 * A "day" for streaks and the daily leaderboard is a calendar day at a fixed UTC offset
 * (DAY_UTC_OFFSET_MINUTES, default UTC+3; ADR 006).
 */
export type DayKey = string; // YYYY-MM-DD

export function dayKey(at: Date, offsetMinutes: number): DayKey {
  return new Date(at.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** The value stored in a `@db.Date` column for a day. */
export function dayDate(key: DayKey): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function keyOfDate(date: Date): DayKey {
  return date.toISOString().slice(0, 10);
}

export function previousDay(key: DayKey): DayKey {
  return keyOfDate(new Date(dayDate(key).getTime() - 86_400_000));
}
