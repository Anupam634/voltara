import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DailyService } from './daily.service';
import { SubmitDailyDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('daily')
export class DailyController {
  constructor(private readonly daily: DailyService) {}

  /** GET /api/daily — today's puzzle, the catalogue, your build, the board. */
  @Get()
  board(@CurrentUser('id') userId: string) {
    return this.daily.board(userId);
  }

  /** POST /api/daily/submit — score a build against today's constraint. */
  @Post('submit')
  submit(@CurrentUser('id') userId: string, @Body() dto: SubmitDailyDto) {
    return this.daily.submit(userId, dto.partCodes);
  }
}
