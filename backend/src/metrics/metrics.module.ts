import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { VisitsService } from './visits.service';

@Module({
  controllers: [MetricsController],
  providers: [VisitsService],
  // The admin panel reads the same totals.
  exports: [VisitsService],
})
export class MetricsModule {}
