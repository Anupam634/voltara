import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ethers } from 'ethers';
import { WithdrawalsService } from './withdrawals.service';
import { RequestWithdrawalDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  /**
   * GET /api/withdrawals/window — are payouts open yet?
   *
   * Declared before the collection route so the withdraw screen can render
   * the closed state instead of a form that would be refused on submit.
   */
  @Get('window')
  window() {
    return this.withdrawals.window();
  }

  /** POST /api/withdrawals — request a payout (min 100 pts, 1/week, KYC). */
  @Post()
  request(@CurrentUser('id') userId: string, @Body() dto: RequestWithdrawalDto) {
    if (!ethers.isAddress(dto.toAddress)) {
      throw new BadRequestException('Not a valid BNB Chain address.');
    }
    // Points arrive as decimals; the service works in integer milli-points.
    const pointsMilli = Math.round(dto.points * 1000);
    return this.withdrawals.request(userId, dto.toAddress, pointsMilli);
  }

  /** GET /api/withdrawals — the caller's own request history. */
  @Get()
  mine(@CurrentUser('id') userId: string) {
    return this.withdrawals.listForUser(userId);
  }
}
