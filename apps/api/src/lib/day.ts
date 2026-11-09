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
  return addDays(key, -1);
}

/** The ISO week of a day, such as `2026-W46`: weeks start on Monday, week 1 holds 4 January. */
export function isoWeek(key: DayKey): string {
  const date = dayDate(key);
  const weekday = (date.getUTCDay() + 6) % 7; // Monday 0 … Sunday 6
  const thursday = new Date(date.getTime() + (3 - weekday) * 86_400_000);
  // A week belongs to the year of its Thursday, and is numbered from that year's first Thursday.
  const year = thursday.getUTCFullYear();
  const dayOfYear = (thursday.getTime() - dayDate(`${year}-01-01`).getTime()) / 86_400_000;
  const week = 1 + Math.floor(dayOfYear / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function addDays(key: DayKey, days: number): DayKey {
  return keyOfDate(new Date(dayDate(key).getTime() + days * 86_400_000));
}
