/**
 * Pure settlement math for rig duels.
 *
 * A duel is a 24h output race. Each side's score is what it mined inside the
 * window; the loser forfeits `stakeBp` of THEIR OWN score to the winner,
 * capped at what they actually hold so a balance can never go negative.
 * Ties transfer nothing. Everything here is integer milli-points.
 */

export const DUEL_WINDOW_HOURS = 24;
/** An OPEN duel nobody accepts expires after this long. */
export const DUEL_OPEN_TTL_HOURS = 48;
export const DEFAULT_STAKE_BP = 1000;
export const BP_ONE = 10_000;

export interface SettleInput {
  challengerScoreMilli: bigint;
  opponentScoreMilli: bigint;
  challengerBalanceMilli: bigint;
  opponentBalanceMilli: bigint;
  stakeBp: number;
}

export interface SettleResult {
  /** 'challenger' | 'opponent' | null on a tie. */
  winner: 'challenger' | 'opponent' | null;
  /** Milli-points moved from loser to winner. 0 on a tie. */
  transferMilli: bigint;
}

function max0(n: bigint): bigint {
  return n < 0n ? 0n : n;
}

export function settleDuel(input: SettleInput): SettleResult {
  const { challengerScoreMilli: c, opponentScoreMilli: o } = input;
  if (c === o) return { winner: null, transferMilli: 0n };

  const winner = c > o ? 'challenger' : 'opponent';
  const loserScore = winner === 'challenger' ? o : c;
  const loserBalance =
    winner === 'challenger' ? input.opponentBalanceMilli : input.challengerBalanceMilli;

  const stake = BigInt(Math.max(0, Math.min(BP_ONE, Math.trunc(input.stakeBp))));
  const wanted = (max0(loserScore) * stake) / BigInt(BP_ONE);
  const transferMilli = wanted < max0(loserBalance) ? wanted : max0(loserBalance);

  return { winner, transferMilli };
}
