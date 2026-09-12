import { readPayoutWindow, type PayoutWindowEnv } from '../withdrawals/payout-window';

/**
 * When identity verification is collected.
 *
 * KYC gates exactly one thing in this codebase — the withdrawal request in
 * `WithdrawalsService.request` — and that path already refuses everyone
 * while `PAYOUTS_OPEN` is false, twenty lines before the KYC check is
 * reached. So until payouts open, asking a miner to upload photographs of
 * their passport buys nothing and costs plenty: it is the heaviest friction
 * in the funnel, it puts real identity documents in the database (base64, in
 * Postgres) with no current use for them, and every submission costs an
 * operator a manual review for a payout that cannot happen.
 *
 * Collecting personal data you have no present need for is a liability, not
 * a feature. A breach would expose real IDs that were never required.
 *
 * **Closed unless something says otherwise, and it follows payouts by
 * default.** Two independent switches would be a footgun in one direction
 * that matters: an operator who opens payouts and forgets KYC turns every
 * withdrawal into "KYC must be approved before withdrawal" with no way for
 * anyone to satisfy it. Following the payout window means opening payouts is
 * enough, and `KYC_OPEN` exists only for the case where verification should
 * deliberately run *ahead* of launch to spread the review load.
 *
 *   KYC_OPEN=true       open now, whatever payouts say
 *   KYC_OPEN_AT=<ISO>   open from that instant
 *   KYC_OPEN=false      closed, whatever the date or payouts say
 *   (neither set)       follows the payout window
 *
 * Note what this does *not* gate: the admin review queue stays open, exactly
 * as withdrawal approve/reject does, so any record submitted before the gate
 * can still be settled rather than stranded.
 */

export interface KycWindow {
  /** True when a miner may submit or re-submit documents. */
  open: boolean;
  /** Announced opening instant, ISO, or null when none is configured. */
  opensAt: string | null;
  /** True when the window is open only because payouts are. */
  followsPayouts: boolean;
}

export interface KycWindowEnv extends PayoutWindowEnv {
  KYC_OPEN?: string | null;
  KYC_OPEN_AT?: string | null;
}

const TRUE = new Set(['1', 'true', 'yes', 'on']);
const FALSE = new Set(['0', 'false', 'no', 'off']);

function parseFlag(raw: string | null | undefined): boolean | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (TRUE.has(v)) return true;
  if (FALSE.has(v)) return false;
  return null;
}

function parseDate(raw: string | null | undefined): Date | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  const at = new Date(v);
  return Number.isNaN(at.getTime()) ? null : at;
}

export function readKycWindow(env: KycWindowEnv, now: Date = new Date()): KycWindow {
  const flag = parseFlag(env.KYC_OPEN);
  const at = parseDate(env.KYC_OPEN_AT);

  // An explicit false is the kill switch and beats everything, including a
  // date and an open payout window — a kill switch a date can override is
  // not a kill switch.
  if (flag === false) {
    return { open: false, opensAt: at ? at.toISOString() : null, followsPayouts: false };
  }
  if (flag === true) {
    return { open: true, opensAt: at ? at.toISOString() : null, followsPayouts: false };
  }
  if (at) {
    return {
      open: now.getTime() >= at.getTime(),
      opensAt: at.toISOString(),
      followsPayouts: false,
    };
  }

  // Nothing configured: verification is needed exactly when a payout is.
  const payouts = readPayoutWindow(env, now);
  return { open: payouts.open, opensAt: payouts.opensAt, followsPayouts: true };
}

/** What a miner is told when they reach a closed window. */
export const KYC_CLOSED_MESSAGE =
  'Identity verification opens when withdrawals do, at the $VLTR token launch. ' +
  'There is nothing to verify for until then, so we do not ask for your documents yet.';
