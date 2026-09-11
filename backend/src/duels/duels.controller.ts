import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DuelsService } from './duels.service';
import { DuelCodeParam } from './dto';

/** Public: the share-link preview. No session needed to look at a duel. */
@Controller('duels')
export class DuelsPublicController {
  constructor(private readonly duels: DuelsService) {}

  /** GET /api/duels/:code — preview for a share link (identities masked). */
  @Get(':code')
  preview(@Param() params: DuelCodeParam) {
    return this.duels.preview(params.code);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('duels')
export class DuelsController {
  constructor(private readonly duels: DuelsService) {}

  /** POST /api/duels — open a challenge and get a code to share. */
  @Post()
  create(@CurrentUser('id') userId: string) {
    return this.duels.create(userId);
  }

  /** GET /api/duels/mine — your open challenge, active duel and history. */
  @Get('mine')
  mine(@CurrentUser('id') userId: string) {
    return this.duels.mine(userId);
  }

  /** POST /api/duels/:code/accept — take the challenge; the 24h race starts now. */
  @Post(':code/accept')
  accept(@CurrentUser('id') userId: string, @Param() params: DuelCodeParam) {
    return this.duels.accept(userId, params.code);
  }

  /** POST /api/duels/:code/cancel — withdraw an open challenge of yours. */
  @Post(':code/cancel')
  cancel(@CurrentUser('id') userId: string, @Param() params: DuelCodeParam) {
    return this.duels.cancel(userId, params.code);
  }
}
