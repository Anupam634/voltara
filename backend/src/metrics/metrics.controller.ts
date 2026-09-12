import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { VisitsService, type VisitBeacon } from './visits.service';

/**
 * The visit beacon.
 *
 * Unguarded on purpose: it is called from the landing page, which is the
 * whole point -- the people worth counting have not signed up yet.
 *
 * 204 with no body, always. The browser has nothing to do with the answer,
 * and a counter that can fail someone's first page load is worse than no
 * counter. The global throttler (300/min) still applies.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly visits: VisitsService) {}

  /** POST /api/metrics/visit — one browsing session. */
  @Post('visit')
  @HttpCode(204)
  async visit(@Body() body: VisitBeacon): Promise<void> {
    await this.visits.record(body ?? {});
  }
}
