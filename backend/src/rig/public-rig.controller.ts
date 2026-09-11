import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { RigService } from './rig.service';

/**
 * The one rig route that needs no token.
 *
 * A share link is read by strangers and, more often, by an unfurling bot
 * that will never hold a session — X, Telegram and WhatsApp all fetch the
 * card before any human sees the post. So this sits in its own controller
 * rather than inside the guarded one, where a `@Public()` decorator would
 * be one refactor away from being silently dropped.
 *
 * Everything it returns is masked and derived; see `RigService.cardFor`.
 */
@Controller('rig')
export class PublicRigController {
  constructor(private readonly rig: RigService) {}

  /** GET /api/rig/card/:code — the public card behind a referral link. */
  @Get('card/:code')
  async card(@Param('code') code: string) {
    const card = await this.rig.cardFor(code);
    if (!card) throw new NotFoundException('No rig for that code.');
    return card;
  }

  /**
   * GET /api/rig/watch/:code — the same rig, with the live readout.
   *
   * Public for the same reason the card is: the leaderboard is public, and a
   * spectator arriving from it has no reason to have an account yet. Watching
   * is the cheapest possible way to show a stranger what the product is.
   */
  @Get('watch/:code')
  async watch(@Param('code') code: string) {
    const rig = await this.rig.watchFor(code);
    if (!rig) throw new NotFoundException('No rig for that code.');
    return rig;
  }
}
