import { Module } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { AuthModule } from '../auth/auth.module';
import { RigModule } from '../rig/rig.module';

@Module({
  imports: [
    AuthModule, // provides JwtAuthGuard
    // RigService installs the parts the reward ladder hands out.
    RigModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
