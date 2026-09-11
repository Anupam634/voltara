import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApprenticeService } from './apprentice.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ApprenticeshipIdDto, GiftPartDto, OfferApprenticeshipDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('apprentice')
export class ApprenticeController {
  constructor(private readonly apprentice: ApprenticeService) {}

  /** GET /api/apprentice — mentorships, own mentor, open offers, eligibility. */
  @Get()
  overview(@CurrentUser('id') userId: string) {
    return this.apprentice.overview(userId);
  }

  /** POST /api/apprentice/offer — offer to mentor the holder of a code. */
  @Post('offer')
  offer(@CurrentUser('id') userId: string, @Body() dto: OfferApprenticeshipDto) {
    return this.apprentice.offer(userId, dto.apprenticeCode);
  }

  /** POST /api/apprentice/accept — the apprentice says yes. */
  @Post('accept')
  accept(@CurrentUser('id') userId: string, @Body() dto: ApprenticeshipIdDto) {
    return this.apprentice.accept(userId, dto.id);
  }

  /** POST /api/apprentice/decline — the apprentice says no. Permanent. */
  @Post('decline')
  decline(@CurrentUser('id') userId: string, @Body() dto: ApprenticeshipIdDto) {
    return this.apprentice.decline(userId, dto.id);
  }

  /** POST /api/apprentice/end — either side ends it. Permanent. */
  @Post('end')
  end(@CurrentUser('id') userId: string, @Body() dto: ApprenticeshipIdDto) {
    return this.apprentice.end(userId, dto.id);
  }

  /** POST /api/apprentice/gift — hand a spare part to an apprentice. */
  @Post('gift')
  gift(@CurrentUser('id') userId: string, @Body() dto: GiftPartDto) {
    return this.apprentice.gift(userId, dto.apprenticeshipId, dto.boosterId);
  }
}
