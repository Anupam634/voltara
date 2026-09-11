import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RigModule } from '../rig/rig.module';
import { DuelsService } from './duels.service';
import { DuelsController, DuelsPublicController } from './duels.controller';

@Module({
  imports: [AuthModule, RigModule],
  // Order matters: `GET duels/mine` must be registered before the public
  // `GET duels/:code`, or the preview route would swallow it.
  controllers: [DuelsController, DuelsPublicController],
  providers: [DuelsService],
  exports: [DuelsService],
})
export class DuelsModule {}
