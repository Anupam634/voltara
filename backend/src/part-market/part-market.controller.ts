import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PartMarketService } from './part-market.service';
import { ListPartDto, MarketQueryDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('market/parts')
export class PartMarketController {
  constructor(private readonly market: PartMarketService) {}

  /** GET /api/market/parts?kind=CORE — open listings. */
  @Get()
  browse(@CurrentUser('id') userId: string, @Query() query: MarketQueryDto) {
    return this.market.browse(userId, query.kind);
  }

  /** GET /api/market/parts/mine — the caller's listings and purchases. */
  @Get('mine')
  mine(@CurrentUser('id') userId: string) {
    return this.market.mine(userId);
  }

  /** POST /api/market/parts — list an idle part for VOLTS. */
  @Post()
  list(@CurrentUser('id') userId: string, @Body() dto: ListPartDto) {
    return this.market.list(userId, dto.boosterId, dto.priceVolts);
  }

  /** DELETE /api/market/parts/:id — take a listing down. */
  @Delete(':id')
  cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.market.cancel(userId, id);
  }

  /** POST /api/market/parts/:id/buy — buy a listed part. */
  @Post(':id/buy')
  buy(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.market.buy(userId, id);
  }
}
