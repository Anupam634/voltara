/**
 * When payouts are open.
 *
 * VOLTS are mined from day one, but $VLTR does not exist until the token
 * launches — so until then there is nothing to send and a payout request
 * would only escrow a miner's balance into a row nobody can ever resolve.
 * Points are debited the moment a request is accepted (see
 * `WithdrawalsService.request`), so "let them queue" is not a harmless
 * default: it takes real balance out of circulation with no way back except
 * an admin rejection.
 *
 * The window is therefore **closed unless something says otherwise**. Two
 * things can say otherwise, and an explicit `PAYOUTS_OPEN=false` beats both
 * — that is the kill switch, and a kill switch that a date can override is
 * not a kill switch.
 *
 *   PAYOUTS_OPEN=true        open now
 *   PAYOUTS_OPEN_AT=<ISO>    open from that instant onwards
 *   PAYOUTS_OPEN=false       closed, whatever the date says
 *   (neither set)            closed
 *
 * `opensAt` is carried even while closed so the UI can say *when* rather
 * than only *not yet*; an unparseable date is dropped rather than trusted,
 * because a bad string must not be read as "the launch already happened".
 */

export interface PayoutWindow {
  /** True when a withdrawal request may be accepted. */
  open: boolean;
  /** Announced opening instant, ISO, or null if no date is configured. */
  opensAt: string | null;
}

/** Environment slice this reads. Passed in so it is testable without env. */
export interface PayoutWindowEnv {
  PAYOUTS_OPEN?: string | null;
  PAYOUTS_OPEN_AT?: string | null;
}

const TRUE = new Set(['1', 'true', 'yes', 'on']);
const FALSE = new Set(['0', 'false', 'no', 'off']);

/** Tri-state: true, false, or "not configured". */
function parseFlag(raw: string | null | undefined): boolean | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (TRUE.has(v)) return true;
  if (FALSE.has(v)) return false;
  return null;
}

/** A date we are willing to act on, or null. Invalid strings are ignored. */
function parseDate(raw: string | null | undefined): Date | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  const at = new Date(v);
  return Number.isNaN(at.getTime()) ? null : at;
}

export function readPayoutWindow(
  env: PayoutWindowEnv,
  now: Date = new Date(),
): PayoutWindow {
  const flag = parseFlag(env.PAYOUTS_OPEN);
  const at = parseDate(env.PAYOUTS_OPEN_AT);
  const opensAt = at ? at.toISOString() : null;

  if (flag === false) return { open: false, opensAt };
  if (flag === true) return { open: true, opensAt };
  if (at) return { open: now.getTime() >= at.getTime(), opensAt };
  return { open: false, opensAt: null };
}

/** What a miner is told when they reach a closed window. */
export const PAYOUTS_CLOSED_MESSAGE =
  'Withdrawals open when the $VLTR token launches. Your VOLTS keep accruing until then.';
