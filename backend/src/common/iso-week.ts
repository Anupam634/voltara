/**
 * ISO week arithmetic, in UTC.
 *
 * Everything that runs "weekly" on the grid has to agree on when a week
 * starts, or a miner can be top of one board and mid-table on another for no
 * reason they can see. The blueprint challenge and the leaderboard season
 * both close on Monday 00:00 UTC, and both get that boundary from here —
 * duplicating this math is how two features quietly drift a day apart.
 *
 * UTC on purpose: a local-time week would start at a different instant for
 * every miner, and the grid is one shared clock.
 */

const DAY = 86_400_000;

/** Monday 00:00 UTC of the ISO week containing `d`. */
export function weekStart(d: Date): Date {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // getUTCDay: Sunday = 0. ISO weeks start Monday.
  const offset = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - offset * DAY);
}

/** ISO week number (1–53) and ISO year for `d`. */
export function isoWeek(d: Date): { year: number; week: number } {
  const start = weekStart(d);
  // The Thursday of this week decides the ISO year.
  const thursday = new Date(start.getTime() + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const firstWeekStart = weekStart(jan4);
  const week = Math.floor((thursday.getTime() - firstWeekStart.getTime()) / (7 * DAY)) + 1;
  return { year, week };
}

/** "2026-W37" */
export function weekKey(d: Date): string {
  const { year, week } = isoWeek(d);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
