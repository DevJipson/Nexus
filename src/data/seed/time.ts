/**
 * Seed timestamps are expressed relative to the moment the demo dataset is
 * created, so the workspace always feels current: overdue work is genuinely
 * overdue, and the week ahead is genuinely ahead.
 */

const DAY_MS = 86_400_000;
const seededAt = Date.now();

/** ISO timestamp `dayOffset` days from seed time, pinned to a wall-clock time. */
export function seedAt(dayOffset: number, hour = 9, minute = 0): string {
  const date = new Date(seededAt + dayOffset * DAY_MS);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/** ISO date at noon, safe across time zones for deadline-only values. */
export function seedDay(dayOffset: number): string {
  return seedAt(dayOffset, 12);
}

export const SEED_ANCHOR = new Date(seededAt).toISOString();
