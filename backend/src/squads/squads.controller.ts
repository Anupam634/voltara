import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SquadsService } from './squads.service';
import { CreateSquadDto, JoinSquadDto } from './dto';

/** Public: the squad leaderboard needs no session. */
@Controller('squads')
export class SquadsPublicController {
  constructor(private readonly squads: SquadsService) {}

  /** GET /api/squads/leaderboard — top squads by mining credits, last 7 days. */
  @Get('leaderboard')
  leaderboard() {
    return this.squads.leaderboard();
  }
}

@UseGuards(JwtAuthGuard)
@Controller('squads')
export class SquadsController {
  constructor(private readonly squads: SquadsService) {}

  /** POST /api/squads — found a squad; the caller becomes owner and first member. */
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateSquadDto) {
    return this.squads.create(userId, dto.name);
  }

  /** POST /api/squads/join — join by invite code, if there is a seat. */
  @Post('join')
  join(@CurrentUser('id') userId: string, @Body() dto: JoinSquadDto) {
    return this.squads.join(userId, dto.code);
  }

  /** POST /api/squads/leave — leave; ownership passes on or the squad dissolves. */
  @Post('leave')
  leave(@CurrentUser('id') userId: string) {
    return this.squads.leave(userId);
  }

  /** GET /api/squads/mine — your squad, its members and what the pool lends. */
  @Get('mine')
  mine(@CurrentUser('id') userId: string) {
    return this.squads.mine(userId);
  }
}
