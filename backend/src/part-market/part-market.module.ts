import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RigModule } from '../rig/rig.module';
import { PartMarketService } from './part-market.service';
import { PartMarketController } from './part-market.controller';

@Module({
  imports: [AuthModule, RigModule],
  controllers: [PartMarketController],
  providers: [PartMarketService],
  exports: [PartMarketService],
})
export class PartMarketModule {}
