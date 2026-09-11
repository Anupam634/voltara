import { Module } from '@nestjs/common';
import { MiningService } from './mining.service';
import { MiningController } from './mining.controller';
import { AuthModule } from '../auth/auth.module';
import { RigModule } from '../rig/rig.module';
import { ApprenticeModule } from '../apprentice/apprentice.module';

@Module({
  // JwtAuthGuard, the rig readout, and the mentor cut paid on every claim.
  imports: [AuthModule, RigModule, ApprenticeModule],
  controllers: [MiningController],
  providers: [MiningService],
  exports: [MiningService],
})
export class MiningModule {}
