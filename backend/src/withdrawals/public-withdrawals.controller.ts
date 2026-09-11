import { Controller, Get } from '@nestjs/common';
import {
  WithdrawalsService,
  WITHDRAWAL_MIN_POINTS,
  POINTS_PER_TOKEN,
} from './withdrawals.service';

/**
 * The payout window, readable without an account.
 *
 * The landing page advertises a conversion ratio and a 100-VOLTS minimum
 * withdrawal. Both are true, and on their own both are misleading: payouts
 * are hard-gated behind `PAYOUTS_OPEN` until $VLTR is on-chain (SPEC §4), so
 * a visitor reading only those two figures concludes they can mine 100 VOLTS
 * and cash out. They cannot, and finding that out after signing up is the
 * kind of thing that costs an audience.
 *
 * So the terms come with their own status, from the same `readPayoutWindow`
 * the withdraw screen and the request path use — one source of truth, and it
 * starts telling the truth the moment the window opens, with no redeploy and
 * nothing to remember to change.
 *
 * Unguarded on purpose, and safe to be: it exposes a published policy and a
 * launch date, nothing about any miner. Registered before the guarded
 * controller, the way `PublicRigController` is.
 */
@Controller('withdrawals')
export class PublicWithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  /** GET /api/withdrawals/status — public payout terms and whether they are live. */
  @Get('status')
  status() {
    const window = this.withdrawals.window();
    return {
      open: window.open,
      /** Announced opening instant, or null when no date has been set. */
      opensAt: window.opensAt,
      minPoints: WITHDRAWAL_MIN_POINTS,
      pointsPerToken: POINTS_PER_TOKEN,
    };
  }
}
