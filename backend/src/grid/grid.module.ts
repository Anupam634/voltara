import { Module } from '@nestjs/common';
import { GridService } from './grid.service';
import { WeatherService } from './weather.service';
import { CollectiveService } from './collective.service';
import { GridController } from './grid.controller';

@Module({
  controllers: [GridController],
  providers: [GridService, WeatherService, CollectiveService],
  // RigModule reads these two on every status poll and claim, so they have
  // to leave the module. Both are in-memory lookups by then.
  exports: [GridService, WeatherService, CollectiveService],
})
export class GridModule {}
