import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RigModule } from '../rig/rig.module';
import { SquadsService } from './squads.service';
import { SquadsController, SquadsPublicController } from './squads.controller';

@Module({
  imports: [AuthModule, RigModule], // JwtAuthGuard + RigContextService
  controllers: [SquadsController, SquadsPublicController],
  providers: [SquadsService],
  exports: [SquadsService],
})
export class SquadsModule {}
