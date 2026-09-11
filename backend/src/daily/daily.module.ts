import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RigModule } from '../rig/rig.module';
import { DailyService } from './daily.service';
import { DailyController } from './daily.controller';

@Module({
  imports: [AuthModule, RigModule],
  controllers: [DailyController],
  providers: [DailyService],
  exports: [DailyService],
})
export class DailyModule {}
