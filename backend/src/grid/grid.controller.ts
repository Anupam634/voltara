import { Controller, Get } from '@nestjs/common';
import { GridService } from './grid.service';
import { WeatherService } from './weather.service';
import { CollectiveService } from './collective.service';

/**
 * Public grid state. No guard on purpose: the landing page shows the live
 * map and the current event to visitors who have not signed up yet, and
 * nothing here identifies a miner.
 */
@Controller('grid')
export class GridController {
  constructor(
    private readonly grid: GridService,
    private readonly weather: WeatherService,
    private readonly collective: CollectiveService,
  ) {}

  /** GET /api/grid/event — active, upcoming and recent grid events. */
  @Get('event')
  event() {
    return this.grid.eventBoard();
  }

  /** GET /api/grid/map — rigs by country, stability, who is online. */
  @Get('map')
  map() {
    return this.grid.map();
  }

  /** GET /api/grid/stats — measured counters for the landing strip. */
  @Get('stats')
  stats() {
    return this.grid.stats();
  }

  /** GET /api/grid/weather — today's temperature where miners actually are. */
  @Get('weather')
  weatherTable() {
    return this.weather.table();
  }

  /** GET /api/grid/collective — the shared stability goal and its bonus. */
  @Get('collective')
  collectiveBoard() {
    return this.collective.board();
  }
}
