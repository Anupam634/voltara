import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RigModule } from '../rig/rig.module';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';

@Module({
  imports: [AuthModule, RigModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
