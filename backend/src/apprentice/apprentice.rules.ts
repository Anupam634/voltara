/**
 * Who may mentor, who may be mentored, and what a mentor earns.
 *
 * Pure and side-effect free so every rule is testable without a database;
 * the grant machinery lives in `apprentice.service.ts`, and every number
 * here is mirrored in SPEC.md.
 *
 * The shape of the feature is deliberate in two ways:
 *
 *  - **The cut is newly minted.** A mentor earns a share of what their
 *    apprentice mines, but it is credited on top rather than deducted.
 *    Taking a slice from a newcomer's first week would make being mentored
 *    a cost, and the fastest way to kill a mentorship feature is to make
 *    the junior side pay for it.
 *  - **It expires.** The cut runs for a fixed window from acceptance, so a
 *    veteran cannot accumulate a permanent rent-seeking position by
 *    adopting everyone who joins in week one.
 */

/** How long an account must exist before it may mentor anyone. */
export const MENTOR_MIN_AGE_DAYS = 7;

/** The stability a mentor's own rig must hold at the moment of offering. */
export const MENTOR_MIN_STABILITY = 100;

/** Past this age an account is no longer a newcomer and cannot be adopted. */
export const APPRENTICE_MAX_AGE_DAYS = 14;

/** How many live apprenticeships one mentor may hold at once. */
export const MAX_ACTIVE_APPRENTICES = 3;

/** The mentor's share of the apprentice's mining, in basis points. */
export const DEFAULT_MENTOR_CUT_BP = 500;

/** How long after acceptance the cut keeps paying. */
export const MENTOR_CUT_DAYS = 30;

const DAY_MS = 86_400_000;

/** Whole days between two instants, floored and never negative. */
export function ageInDays(createdAt: Date, now: Date = new Date()): number {
  const ms = now.getTime() - createdAt.getTime();
  return Math.max(0, Math.floor(ms / DAY_MS));
}

/** Why a miner may not mentor right now. `null` means they may. */
export type MentorBlock =
  | 'TOO_NEW'
  | 'RIG_UNSTABLE'
  | 'AT_CAPACITY'
  | 'IS_APPRENTICE';

export interface MentorEligibility {
  canMentor: boolean;
  reason: MentorBlock | null;
  /** Days still to wait, when the block is TOO_NEW. */
  daysToWait: number;
  activeCount: number;
  capacity: number;
}

/**
 * Whether this account may take on an apprentice.
 *
 * The stability requirement is the interesting one: it means a mentor has
 * demonstrably solved the thing they are about to teach, and it re-checks at
 * the moment of offering rather than once, so a veteran whose rig is
 * currently cooking cannot recruit on a reputation they are not living up to.
 */
export function mentorEligibility(params: {
  createdAt: Date;
  gridStability: number;
  activeApprentices: number;
  /** True when this miner is themselves being mentored. */
  hasMentor: boolean;
  now?: Date;
}): MentorEligibility {
  const now = params.now ?? new Date();
  const age = ageInDays(params.createdAt, now);
  const base = {
    activeCount: params.activeApprentices,
    capacity: MAX_ACTIVE_APPRENTICES,
    daysToWait: Math.max(0, MENTOR_MIN_AGE_DAYS - age),
  };

  if (age < MENTOR_MIN_AGE_DAYS) {
    return { ...base, canMentor: false, reason: 'TOO_NEW' };
  }
  // Someone still learning should not also be teaching: it would let a pair
  // of new accounts adopt each other and both draw a cut on day seven.
  if (params.hasMentor) {
    return { ...base, canMentor: false, reason: 'IS_APPRENTICE' };
  }
  if (params.gridStability < MENTOR_MIN_STABILITY) {
    return { ...base, canMentor: false, reason: 'RIG_UNSTABLE' };
  }
  if (params.activeApprentices >= MAX_ACTIVE_APPRENTICES) {
    return { ...base, canMentor: false, reason: 'AT_CAPACITY' };
  }
  return { ...base, canMentor: true, reason: null };
}

/** Why a miner may not be adopted. `null` means they may. */
export type ApprenticeBlock = 'TOO_OLD' | 'HAS_MENTOR' | 'IS_SELF';

/** Whether this account may be taken on as an apprentice. */
export function apprenticeEligibility(params: {
  createdAt: Date;
  hasMentor: boolean;
  isSelf: boolean;
  now?: Date;
}): { canBeAdopted: boolean; reason: ApprenticeBlock | null } {
  if (params.isSelf) return { canBeAdopted: false, reason: 'IS_SELF' };
  if (params.hasMentor) return { canBeAdopted: false, reason: 'HAS_MENTOR' };
  if (ageInDays(params.createdAt, params.now) >= APPRENTICE_MAX_AGE_DAYS) {
    return { canBeAdopted: false, reason: 'TOO_OLD' };
  }
  return { canBeAdopted: true, reason: null };
}

/** When a mentorship accepted at `acceptedAt` stops paying its cut. */
export function cutExpiresAt(acceptedAt: Date): Date {
  return new Date(acceptedAt.getTime() + MENTOR_CUT_DAYS * DAY_MS);
}

/** Whether the cut is still running for a mentorship accepted at that time. */
export function cutIsLive(acceptedAt: Date | null, now: Date = new Date()): boolean {
  if (!acceptedAt) return false;
  return now.getTime() < cutExpiresAt(acceptedAt).getTime();
}

/**
 * The mentor's share of one claim, in milli-points.
 *
 * Newly minted, so it is never subtracted from `earned` — the apprentice's
 * own credit is untouched. Floored, and zero for a claim too small to split,
 * which keeps a flood of one-milli claims from minting anything.
 */
export function mentorCutMilli(params: {
  earnedMilli: number;
  mentorCutBp?: number;
  acceptedAt: Date | null;
  now?: Date;
}): number {
  if (!cutIsLive(params.acceptedAt, params.now)) return 0;
  const earned = Math.max(0, Math.floor(params.earnedMilli));
  const bp = Math.max(0, Math.min(10_000, params.mentorCutBp ?? DEFAULT_MENTOR_CUT_BP));
  return Math.floor((earned * bp) / 10_000);
}
