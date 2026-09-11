import { Module } from '@nestjs/common';
import { BoostersService } from './boosters.service';
import { BoostersController } from './boosters.controller';
import { ChainReaderService } from './chain-reader.service';
import { AuthModule } from '../auth/auth.module';
import { RigModule } from '../rig/rig.module';

@Module({
  // AuthModule provides JwtAuthGuard; RigModule installs a paid part into a
  // free slot the moment the payment clears.
  imports: [AuthModule, RigModule],
  controllers: [BoostersController],
  providers: [BoostersService, ChainReaderService],
})
export class BoostersModule {}
