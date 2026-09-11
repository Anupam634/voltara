import { weekKey, weekStart } from '../common/iso-week';

/**
 * Pure rules for the weekly leaderboard season.
 *
 * A season is one ISO week: Monday 00:00 UTC to the next Monday 00:00 UTC.
 * The leaderboard's own WEEK filter is a *rolling* seven days, which is the
 * right thing for browsing ("who is hot right now") and the wrong thing for
 * a prize — a rolling window has no moment at which anyone has won. So the
 * season keeps its own fixed boundary, shared with the blueprint challenge
 * via `common/iso-week.ts`.
 *
 * Prizes are paid in VOLTS, not $VLTR: the token is not on-chain until
 * launch and payouts are gated until then (SPEC §4), so a $VLTR pool would
 * be an IOU. VOLTS are real the moment they land — they buy parts, and they
 * convert at 3:1 when the payout window opens.
 */

const DAY = 86_400_000;
const MILLI = 1000;

/** How many miners are paid when a season closes. */
export const SEASON_SIZE = 10;

/**
 * VOLTS per finishing rank, highest first.
 *
 * Sized against the free rate: a bare chassis makes 0.90 VOLTS/h, about 151
 * in a week. First place is worth a bit more than a free week of mining, and
 * tenth is worth an evening — enough to be chased, not so much that the
 * board becomes the only way to earn. The whole pool is 625 VOLTS a week.
 */
export const PRIZE_VOLTS: readonly number[] = [200, 120, 80, 50, 50, 25, 25, 25, 25, 25];

/** Total VOLTS paid out by one season, for the admin and the UI. */
export const SEASON_POOL_VOLTS = PRIZE_VOLTS.reduce((a, b) => a + b, 0);

/**
 * Ledger reasons that do NOT count towards a season.
 *
 * A season prize is credited after its week has closed, which lands it in
 * the *next* week — so counting it would hand last week's winner a head
 * start on this week for no mining at all. Admin adjustments are excluded
 * for the same reason: a support refund is not a performance.
 */
export const EXCLUDED_REASONS = ['SEASON_REWARD', 'ADMIN_ADJUST'] as const;

export interface SeasonWindow {
  /** "2026-W37" */
  key: string;
  startsAt: Date;
  endsAt: Date;
}

/** The season `d` falls inside. */
export function seasonFor(d: Date): SeasonWindow {
  const startsAt = weekStart(d);
  return {
    key: weekKey(d),
    startsAt,
    endsAt: new Date(startsAt.getTime() + 7 * DAY),
  };
}

/** The season immediately before the one containing `d`. */
export function previousSeason(d: Date): SeasonWindow {
  return seasonFor(new Date(weekStart(d).getTime() - DAY));
}

/** VOLTS for a 1-based finishing rank; 0 outside the paid places. */
export function prizeForRank(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > PRIZE_VOLTS.length) return 0;
  return PRIZE_VOLTS[rank - 1];
}

/** The same prize in the integer milli-points the ledger stores. */
export function prizeMilliForRank(rank: number): bigint {
  return BigInt(Math.round(prizeForRank(rank) * MILLI));
}

export interface EarnerRow {
  userId: string;
  earnedMilli: bigint;
}

export interface SeasonPlacing {
  userId: string;
  rank: number;
  earnedMilli: bigint;
  prizeMilli: bigint;
}

/**
 * Rank earners and attach prizes.
 *
 * Ties are broken by user id rather than left to the database's ordering, so
 * closing the same season twice — a retry, a second instance — ranks the two
 * miners the same way both times. Anyone who earned nothing is dropped: a
 * season with four active miners pays four, not ten with six zeroes.
 */
export function rankSeason(
  rows: EarnerRow[],
  size: number = SEASON_SIZE,
): SeasonPlacing[] {
  return [...rows]
    .filter((r) => r.earnedMilli > 0n)
    .sort((a, b) => {
      if (a.earnedMilli !== b.earnedMilli) return a.earnedMilli > b.earnedMilli ? -1 : 1;
      return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
    })
    .slice(0, size)
    .map((r, i) => ({
      userId: r.userId,
      rank: i + 1,
      earnedMilli: r.earnedMilli,
      prizeMilli: prizeMilliForRank(i + 1),
    }));
}
