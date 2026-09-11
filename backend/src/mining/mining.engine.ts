/**
 * Pure reward-math for the Voltara mining engine.
 *
 * Everything here is deterministic and side-effect free so it can be unit
 * tested in isolation. All point values flow as MILLI-POINTS (integer,
 * 1 point = 1000 milli) to avoid floating-point drift in balances.
 *
 * Rules mirror SPEC.md §2 and §2c. If a number changes, change it in
 * SPEC.md too.
 */

import type { RigTelemetry } from './rig.engine';

export const MILLI = 1000;
export const BASE_RATE_MILLI = 900; // 0.9 points/hour

/**
 * The tap cadence from SPEC §2: accrual is capped at this many hours, and
 * the same window gates the next "Mine" tap.
 */
export const CLAIM_WINDOW_HOURS = 24;

/**
 * What a brand-new miner collects on their very first tap.
 *
 * Without a cap the first tap pays a full window at the starter rate, which
 * with the free 72h loaner core is ~69 VOLTS — most of the 100 VOLTS
 * withdrawal minimum, handed over before the miner has done anything. The
 * cap keeps the first tap a *taste*: it fires instantly, the shockwave and
 * the sound land, and the real reward is the full window waiting 24h later.
 *
 * One number, deliberately easy to find: raise it to be more generous.
 */
export const WELCOME_CLAIM_MILLI = 5_000; // 5.0 VOLTS

/**
 * Claim streak.
 *
 * A tap inside `STREAK_GRACE_HOURS` of the cooldown lifting extends the
 * streak; a later tap resets it to 1. Longer streaks multiply the rate, so
 * the cost of missing a day is visible and growing — which is the whole
 * point of a streak.
 *
 * Kept modest: the top tier is +15%, well under a single referral tier, so
 * a streak rewards showing up without becoming the main lever.
 */
export const STREAK_GRACE_HOURS = 24;

export interface StreakTier {
  minDays: number;
  bonusBp: number;
}

export const STREAK_TIERS: StreakTier[] = [
  { minDays: 30, bonusBp: 1_500 },
  { minDays: 14, bonusBp: 1_000 },
  { minDays: 7, bonusBp: 700 },
  { minDays: 3, bonusBp: 300 },
];

/** Rate bonus for a streak length, in basis points. 700 = +7%. */
export function streakBonusBp(streakDays: number): number {
  const n = Math.max(0, Math.floor(streakDays));
  return STREAK_TIERS.find((t) => n >= t.minDays)?.bonusBp ?? 0;
}

/** The next tier a miner is climbing towards, or null at the top. */
export function nextStreakTier(streakDays: number): StreakTier | null {
  const n = Math.max(0, Math.floor(streakDays));
  const climbing = [...STREAK_TIERS]
    .sort((a, b) => a.minDays - b.minDays)
    .find((t) => n < t.minDays);
  return climbing ?? null;
}

/**
 * The streak after a claim made at `now`.
 *
 * `lastMineAt` null means this is the first ever tap, which starts a streak
 * of 1. A tap after the cooldown but inside the grace window continues the
 * run; anything later starts over.
 */
export function nextStreakDays(params: {
  streakDays: number;
  lastMineAt: Date | null;
  now?: Date;
  cooldownHours?: number;
  graceHours?: number;
}): number {
  if (!params.lastMineAt) return 1;
  const now = params.now ?? new Date();
  const cooldown = params.cooldownHours ?? CLAIM_WINDOW_HOURS;
  const grace = params.graceHours ?? STREAK_GRACE_HOURS;
  const elapsedH = (now.getTime() - params.lastMineAt.getTime()) / 3_600_000;
  const kept = elapsedH <= cooldown + grace;
  return kept ? Math.max(1, Math.floor(params.streakDays)) + 1 : 1;
}

/** Referral multiplier tiers, keyed by number of invited users (SPEC §2). */
export interface ReferralTier {
  minInvites: number;
  maxInvites: number;
  level: number;
  multiplier: number;
}

export const REFERRAL_TIERS: ReferralTier[] = [
  { minInvites: 0, maxInvites: 0, level: 1, multiplier: 1 },
  { minInvites: 1, maxInvites: 5, level: 2, multiplier: 3 },
  { minInvites: 6, maxInvites: 10, level: 3, multiplier: 4 },
  { minInvites: 11, maxInvites: 20, level: 4, multiplier: 5 },
  { minInvites: 21, maxInvites: 30, level: 5, multiplier: 6 },
  { minInvites: 31, maxInvites: 2000, level: 6, multiplier: 8 },
];

export function referralTierFor(inviteCount: number): ReferralTier {
  const n = Math.max(0, Math.floor(inviteCount));
  const tier = REFERRAL_TIERS.find(
    (t) => n >= t.minInvites && n <= t.maxInvites,
  );
  // Above the top band we clamp to the highest tier rather than falling back.
  return tier ?? REFERRAL_TIERS[REFERRAL_TIERS.length - 1];
}

/**
 * Effective mining rate in milli-points/hour.
 *
 * Model (SPEC §2 + §2a):
 *   rate = (base + rig hash + admin adjust)
 *          × thermal efficiency × power efficiency
 *          × referral multiplier
 *
 * The rig readout comes from `rig.engine.ts` — it already folded module
 * boosts into `hashMilli` and turned an unbalanced build into the two
 * efficiency factors. A bare chassis has no parts, so both factors are 1 and
 * a brand-new miner earns exactly the base rate.
 *
 * A single VC-1 core on a stock chassis: (900 + 2000) × 1 × 1 × 1 = 2.9/hr.
 */
export function effectiveRateMilli(params: {
  /** Installed-rig readout. Omitted (or empty) means a bare chassis. */
  rig?: Pick<
    RigTelemetry,
    'hashMilli' | 'thermalEfficiency' | 'powerEfficiency'
  >;
  inviteCount: number;
  /** Admin override from the panel (SPEC §6), signed milli-points/hour. */
  rateAdjustMilli?: number;
  /** Consecutive daily claims. Longer runs earn a small rate bonus. */
  streakDays?: number;
}): number {
  const hash = Math.max(0, params.rig?.hashMilli ?? 0);
  // The admin adjustment lands alongside rig hash, before the penalties and
  // the referral multiplier. Floored at 0 so a large negative adjustment
  // stalls mining rather than accruing a negative balance.
  const raw = Math.max(0, BASE_RATE_MILLI + hash + (params.rateAdjustMilli ?? 0));

  const thermal = params.rig?.thermalEfficiency ?? 1;
  const power = params.rig?.powerEfficiency ?? 1;
  const throttled = Math.floor(raw * thermal * power);

  const mult = referralTierFor(params.inviteCount).multiplier;
  const streaked = Math.floor(
    (throttled * (10_000 + streakBonusBp(params.streakDays ?? 0))) / 10_000,
  );
  return streaked * mult;
}

/**
 * Points accrued for an elapsed period, capped at the 24h claim window.
 *
 * The user must tap "Mine" once per 24h; accrual only counts up to
 * `claimWindowHours` since the last tap (default 24). This is the
 * "offline earnings" a tap collects.
 */
export function accrueMilli(params: {
  rateMilli: number;
  lastMineAt: Date | null;
  now?: Date;
  claimWindowHours?: number;
  /** Ceiling on the first-ever tap. Defaults to WELCOME_CLAIM_MILLI. */
  welcomeCapMilli?: number;
}): number {
  const now = params.now ?? new Date();
  const windowH = params.claimWindowHours ?? CLAIM_WINDOW_HOURS;
  if (!params.lastMineAt) {
    // The first-ever tap is a welcome, not a full day's mining: it fires
    // the moment the account exists, so paying a whole window would hand
    // out most of the withdrawal minimum for nothing. See
    // WELCOME_CLAIM_MILLI.
    const full = Math.floor(params.rateMilli * windowH);
    const cap = params.welcomeCapMilli ?? WELCOME_CLAIM_MILLI;
    return Math.min(full, Math.max(0, cap));
  }
  const elapsedMs = now.getTime() - params.lastMineAt.getTime();
  const elapsedH = Math.max(0, elapsedMs / 3_600_000);
  const cappedH = Math.min(elapsedH, windowH);
  return Math.floor(params.rateMilli * cappedH);
}

/** Whether the 24h cooldown has elapsed so the user may tap "Mine" again. */
export function canClaim(params: {
  lastMineAt: Date | null;
  now?: Date;
  cooldownHours?: number;
}): boolean {
  if (!params.lastMineAt) return true;
  const now = params.now ?? new Date();
  const cooldown = (params.cooldownHours ?? CLAIM_WINDOW_HOURS) * 3_600_000;
  return now.getTime() - params.lastMineAt.getTime() >= cooldown;
}

/** Convert milli-points to mainnet $VLTR (3 points = 1 token). */
export function pointsToToken(
  milliPoints: bigint | number,
  pointsPerToken = 3,
): number {
  const points = Number(milliPoints) / MILLI;
  return points / pointsPerToken;
}
