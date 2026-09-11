import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SeasonsService } from './seasons.service';

@UseGuards(JwtAuthGuard)
@Controller('season')
export class SeasonsController {
  constructor(private readonly seasons: SeasonsService) {}

  /**
   * GET /api/season — this week's fixed Monday-to-Monday season, scored
   * live, plus the caller's standing and the last season that paid.
   */
  @Get()
  board(@CurrentUser('id') userId: string) {
    return this.seasons.board(userId);
  }
}
