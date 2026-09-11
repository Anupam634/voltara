import { Module } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { PublicWithdrawalsController } from './public-withdrawals.controller';
import { WalletService } from '../wallet/wallet.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // provides JwtAuthGuard
  // The public status route is listed first so its concrete `status` path
  // is matched before anything guarded, the way RigModule does it.
  controllers: [PublicWithdrawalsController, WithdrawalsController],
  providers: [WithdrawalsService, WalletService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
