/**
 * The referral reward ladder (GROWTH.md §3).
 *
 * A referral used to move nothing but an abstract rate multiplier, which a
 * miner cannot see, point at, or screenshot. Parts can: they sit in a slot,
 * they change the gauge, and they show up on the rig card. So the ladder
 * pays in hardware.
 *
 * Pure and side-effect free — the grant machinery lives in
 * `referrals.service.ts`, and every number here is mirrored in SPEC.md.
 */

/** What a tier hands over. */
export type ReferralRewardKind =
  /** Adds hours to the *invitee's* starter core, not the inviter's. */
  | 'LOANER_EXTENSION'
  /** Grants a catalogue part to the inviter. */
  | 'PART'
  /** Widens the inviter's chassis. */
  | 'SLOT'
  /** Cosmetic standing. No economic effect. */
  | 'BADGE';

export interface ReferralRewardTier {
  /**
   * Stable identity of the tier, written to `LedgerEntry.meta.tier`.
   *
   * Deliberately equal to `invites`: the threshold is the one number that
   * can never be renumbered without changing what the tier *is*, so an
   * already-granted row stays matched even if the ladder grows around it.
   */
  tier: number;
  /** Direct referrals needed to unlock. */
  invites: number;
  kind: ReferralRewardKind;
  /** Machine name, written to `LedgerEntry.meta.reward`. */
  reward: string;
  /** English fallback label. The UI renders its own translated copy. */
  label: string;
  /** Catalogue code, for `kind: 'PART'`. */
  partCode?: string;
  /** How long a granted part runs, for `kind: 'PART'`. */
  durationDays?: number;
  /** Hours added to the invitee's loaner, for `kind: 'LOANER_EXTENSION'`. */
  extendHours?: number;
  /** Chassis width the tier raises the inviter to, for `kind: 'SLOT'`. */
  slots?: number;
}

/**
 * Ordered by threshold, ascending.
 *
 * The shape of the ladder is deliberate: the first two rungs teach the
 * mechanic (a cooler, then a PSU — the two things a new miner does not yet
 * understand they need), the third is the only permanent grant in the game,
 * and the last is pure status. Nothing here pays points, so inviting can
 * never be farmed for a withdrawal.
 */
export const REFERRAL_REWARD_TIERS: ReferralRewardTier[] = [
  {
    tier: 1,
    invites: 1,
    kind: 'LOANER_EXTENSION',
    reward: 'LOANER_24H',
    label: 'Your invitee gets +24h on their starter core',
    extendHours: 24,
  },
  {
    tier: 3,
    invites: 3,
    kind: 'PART',
    reward: 'CX2',
    label: 'CX-2 Vapor Cooler, free for 30 days',
    partCode: 'CX2',
    durationDays: 30,
  },
  {
    tier: 5,
    invites: 5,
    kind: 'PART',
    reward: 'PS3',
    label: 'PS-3 Feeder Unit, free for 30 days',
    partCode: 'PS3',
    durationDays: 30,
  },
  {
    tier: 10,
    invites: 10,
    kind: 'SLOT',
    reward: 'SLOT_7',
    label: 'A permanent seventh rig slot',
    slots: 7,
  },
  {
    tier: 25,
    invites: 25,
    kind: 'BADGE',
    reward: 'GRID_OPERATOR',
    label: 'Grid Operator standing',
  },
];

/** Every tier an invite count has reached, ascending. */
export function rewardsFor(inviteCount: number): ReferralRewardTier[] {
  const n = Math.max(0, Math.floor(inviteCount));
  return REFERRAL_REWARD_TIERS.filter((t) => n >= t.invites);
}

/** The next rung being climbed, or null once the ladder is finished. */
export function nextRewardTier(inviteCount: number): ReferralRewardTier | null {
  const n = Math.max(0, Math.floor(inviteCount));
  return REFERRAL_REWARD_TIERS.find((t) => n < t.invites) ?? null;
}

/**
 * Tiers that are unlocked but not yet handed over.
 *
 * `grantedTiers` comes from the miner's own ledger, so a tier granted by an
 * earlier pass — or by a second instance running the same cron — is never
 * paid twice.
 */
export function pendingRewards(
  inviteCount: number,
  grantedTiers: Iterable<number>,
): ReferralRewardTier[] {
  const done = new Set(grantedTiers);
  return rewardsFor(inviteCount).filter((t) => !done.has(t.tier));
}

/**
 * The tier id recorded on a ledger row, or null when the row is not a
 * reward grant. Tolerant of anything: `meta` is untyped JSON.
 */
export function tierFromMeta(meta: unknown): number | null {
  if (!meta || typeof meta !== 'object') return null;
  const value = (meta as Record<string, unknown>).tier;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  return null;
}
