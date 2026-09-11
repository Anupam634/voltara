import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChallengesService } from './challenges.service';
import { SubmitBlueprintDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('challenge')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  /** GET /api/challenge — this week's brief, the catalogue, your entry, the top ten. */
  @Get()
  board(@CurrentUser('id') userId: string) {
    return this.challenges.board(userId);
  }

  /** POST /api/challenge/submit — enter (or replace) your blueprint. */
  @Post('submit')
  submit(@CurrentUser('id') userId: string, @Body() dto: SubmitBlueprintDto) {
    return this.challenges.submit(userId, dto.partCodes);
  }
}
