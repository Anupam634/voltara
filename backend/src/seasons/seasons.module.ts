import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SeasonsService } from './seasons.service';
import { SeasonsController } from './seasons.controller';

@Module({
  imports: [AuthModule], // provides JwtAuthGuard
  controllers: [SeasonsController],
  providers: [SeasonsService],
  exports: [SeasonsService],
})
export class SeasonsModule {}
