/**
 * Pure rules for the weekly blueprint challenge.
 *
 * "Cheapest rig that makes N hash/h at 100% stability." Weeks are ISO weeks
 * in UTC so every miner on the grid sees the same clock; the target rotates
 * with the week number so a returning miner meets a fresh problem.
 */

// The week boundary is shared with the leaderboard season — see
// `common/iso-week.ts`. Re-exported so this module stays the one import a
// challenge caller needs.
import { isoWeek, weekKey, weekStart } from '../common/iso-week';

export { isoWeek, weekKey, weekStart };

/** Hash targets (points/hour) rotated by ISO week number. */
export const TARGETS_PER_HOUR = [5, 12, 25, 40] as const;

/** Plan codes granted to 1st, 2nd and 3rd place when a week closes. */
export const REWARD_CODES = ['VC5', 'CX2', 'VC1'] as const;

/** Parts allowed in one blueprint — a stock chassis has six slots. */
export const MAX_PARTS = 6;

const DAY = 86_400_000;

/** The challenge a given instant belongs to. */
export function challengeFor(d: Date): {
  weekKey: string;
  startsAt: Date;
  endsAt: Date;
  targetPerHour: number;
  title: string;
  body: string;
} {
  const startsAt = weekStart(d);
  const endsAt = new Date(startsAt.getTime() + 7 * DAY);
  const { week } = isoWeek(d);
  const targetPerHour = TARGETS_PER_HOUR[(week - 1) % TARGETS_PER_HOUR.length];
  return {
    weekKey: weekKey(d),
    startsAt,
    endsAt,
    targetPerHour,
    title: `Cheapest ${targetPerHour} hash/h at 100% stability`,
    body:
      `Build a rig on a stock chassis that makes at least ${targetPerHour} hash per hour ` +
      `with GRID STABILITY at 100%. Lowest total part cost wins; ties go to the higher hash, then the earlier entry. ` +
      `Top three win a ${REWARD_CODES[0]}, ${REWARD_CODES[1]} and ${REWARD_CODES[2]} when the week closes.`,
  };
}

export interface Rankable {
  costUsd: number;
  hashMilli: number;
  createdAt: Date;
}

/**
 * Cheapest first; ties broken by more hash, then by who got there first.
 * Exported so the DB query's orderBy and the in-memory rank agree.
 */
export function compareSubmissions(a: Rankable, b: Rankable): number {
  if (a.costUsd !== b.costUsd) return a.costUsd - b.costUsd;
  if (a.hashMilli !== b.hashMilli) return b.hashMilli - a.hashMilli;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export function rankSubmissions<T extends Rankable>(rows: T[]): (T & { rank: number })[] {
  return [...rows].sort(compareSubmissions).map((r, i) => ({ ...r, rank: i + 1 }));
}
