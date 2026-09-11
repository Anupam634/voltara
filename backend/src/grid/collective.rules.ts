/**
 * The collective grid goal.
 *
 * Every rig on the platform contributes to one shared number: the share of
 * active rigs holding 100% GRID STABILITY. When the grid as a whole holds
 * the line, every miner earns a little more.
 *
 * It is a BONUS and never a penalty, which is the whole design. A collective
 * mechanic that punishes you for strangers' bad builds reads as unfair no
 * matter how small it is, and the miners who leave over it are exactly the
 * careful ones you wanted to keep. Framed as a bonus, the same number turns
 * into a reason to help someone else fix their cooling.
 *
 * Pure and side-effect free; `collective.service.ts` supplies the share.
 */

import { BP_ONE } from '../mining/rig.engine';

/** Share of active rigs at 100% stability needed to earn the bonus. */
export const COLLECTIVE_THRESHOLD_PERCENT = 70;

/** What holding the line is worth to every miner, in basis points. 500 = +5%. */
export const COLLECTIVE_BONUS_BP = 500;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * The hash bonus for a given platform-wide stability share, in basis points.
 *
 * Always zero or positive: there is no arrangement of other people's rigs
 * that can cost a miner anything.
 */
export function collectiveBonusBp(stablePercent: number | null | undefined): number {
  if (stablePercent === null || stablePercent === undefined || !Number.isFinite(stablePercent)) {
    return 0;
  }
  const share = clamp(stablePercent, 0, 100);
  return share >= COLLECTIVE_THRESHOLD_PERCENT ? COLLECTIVE_BONUS_BP : 0;
}

/** The same figure as a hash multiplier, in basis points. */
export function collectiveHashMultBp(stablePercent: number | null | undefined): number {
  return BP_ONE + collectiveBonusBp(stablePercent);
}

/** Whether the grid is currently holding. */
export function isHolding(stablePercent: number | null | undefined): boolean {
  return collectiveBonusBp(stablePercent) > 0;
}

/** How many points of share are still missing, for the "almost there" line. */
export function pointsToThreshold(stablePercent: number | null | undefined): number {
  if (stablePercent === null || stablePercent === undefined || !Number.isFinite(stablePercent)) {
    return COLLECTIVE_THRESHOLD_PERCENT;
  }
  return Math.max(0, COLLECTIVE_THRESHOLD_PERCENT - clamp(stablePercent, 0, 100));
}
