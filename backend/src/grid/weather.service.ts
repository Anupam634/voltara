import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { BP_ONE } from '../mining/rig.engine';
import {
  CAPITAL_COORDS,
  weatherHeatBp,
  weatherHeatPercent,
} from './weather.rules';

/** How long a reading stays usable if a refresh fails. */
const READING_MAX_AGE_MS = 12 * 3_600_000;
/** Coordinates per Open-Meteo request. Their API takes comma-separated lists. */
const BATCH_SIZE = 40;
/** Give up on the network rather than hold the cron open. */
const FETCH_TIMEOUT_MS = 8_000;
/** Never ask about more countries than this, whatever the user table says. */
const COUNTRY_CAP = 60;

export interface WeatherReading {
  countryCode: string;
  city: string;
  tempC: number;
  heatBp: number;
  heatPercent: number;
  readAt: Date;
}

/** One entry of the public table. */
export interface WeatherEntry {
  countryCode: string;
  city: string;
  tempC: number;
  heatPercent: number;
}

interface OpenMeteoPoint {
  latitude?: number;
  longitude?: number;
  current?: { temperature_2m?: number };
}

/**
 * Today's temperature where each miner actually lives, turned into a heat
 * multiplier on their rig.
 *
 * Three rules this service never breaks:
 *
 *  1. **A request never waits on the network.** The cron fills an in-memory
 *     map; every read is a map lookup. A mining claim that blocked on a
 *     weather API would be an outage waiting to happen.
 *  2. **Failure is neutral, never a penalty.** No reading, a stale reading,
 *     or a country not in the table all mean "no effect" — a third-party
 *     outage must not show up as heat on someone's rig.
 *  3. **It only ever asks about countries that have miners**, capped, so the
 *     request count is bounded by the product and not by the world.
 */
@Injectable()
export class WeatherService implements OnModuleInit {
  private readonly log = new Logger(WeatherService.name);
  private readings = new Map<string, WeatherReading>();
  private refreshing: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // Deliberately not awaited: a slow or unreachable weather API must not
    // hold up application boot.
    void this.refresh().catch(() => undefined);
  }

  /** Every three hours. Weather does not move faster than the game needs. */
  @Cron('0 */3 * * *')
  async tick(): Promise<void> {
    await this.refresh().catch((err: unknown) => {
      this.log.warn(`Weather refresh failed: ${String(err)}`);
    });
  }

  /**
   * The heat multiplier for a country right now, in basis points.
   *
   * Synchronous and allocation-free on purpose — it is called on every
   * status poll and every claim settlement.
   */
  heatBpFor(countryCode: string | null | undefined): number {
    const reading = this.readingFor(countryCode);
    return reading ? reading.heatBp : BP_ONE;
  }

  /** The reading behind that multiplier, for the UI to explain it. */
  readingFor(countryCode: string | null | undefined): WeatherReading | null {
    if (!countryCode) return null;
    const reading = this.readings.get(countryCode.toUpperCase());
    if (!reading) return null;
    if (Date.now() - reading.readAt.getTime() > READING_MAX_AGE_MS) return null;
    return reading;
  }

  /** GET /api/grid/weather — every country the grid currently has a reading for. */
  table(): { countries: WeatherEntry[]; updatedAt: Date | null } {
    const now = Date.now();
    const countries: WeatherEntry[] = [];
    let newest: Date | null = null;

    for (const r of this.readings.values()) {
      if (now - r.readAt.getTime() > READING_MAX_AGE_MS) continue;
      countries.push({
        countryCode: r.countryCode,
        city: r.city,
        tempC: r.tempC,
        heatPercent: r.heatPercent,
      });
      if (!newest || r.readAt > newest) newest = r.readAt;
    }

    countries.sort((a, b) => b.tempC - a.tempC || a.countryCode.localeCompare(b.countryCode));
    return { countries, updatedAt: newest };
  }

  /**
   * Re-read every country that has miners.
   *
   * Single-flighted: two crons overlapping (or a cron racing boot) share one
   * pass rather than doubling the outbound requests.
   */
  async refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<void> {
    const codes = await this.countriesWithMiners();
    if (codes.length === 0) return;

    const next = new Map<string, WeatherReading>(this.readings);
    const readAt = new Date();

    for (let i = 0; i < codes.length; i += BATCH_SIZE) {
      const batch = codes.slice(i, i + BATCH_SIZE);
      const points = await this.fetchBatch(batch);
      if (!points) continue; // that batch failed; keep whatever we had
      batch.forEach((code, idx) => {
        const tempC = points[idx]?.current?.temperature_2m;
        if (typeof tempC !== 'number' || !Number.isFinite(tempC)) return;
        const coords = CAPITAL_COORDS[code];
        if (!coords) return;
        next.set(code, {
          countryCode: code,
          city: coords.city,
          tempC: Math.round(tempC * 10) / 10,
          heatBp: weatherHeatBp(tempC),
          heatPercent: weatherHeatPercent(tempC),
          readAt,
        });
      });
    }

    this.readings = next;
    this.log.log(`Weather refreshed for ${next.size} countries.`);
  }

  /**
   * Which countries to ask about: the ones miners are actually in, narrowed
   * to those the coordinate table knows, capped.
   */
  private async countriesWithMiners(): Promise<string[]> {
    try {
      const rows = await this.prisma.user.groupBy({
        by: ['countryCode'],
        where: { isBlocked: false, countryCode: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { countryCode: 'desc' } },
        take: COUNTRY_CAP * 2,
      });
      const codes = rows
        .map((r) => r.countryCode?.toUpperCase())
        .filter((c): c is string => !!c && c in CAPITAL_COORDS);
      return codes.slice(0, COUNTRY_CAP);
    } catch (err: unknown) {
      this.log.warn(`Could not read miner countries: ${String(err)}`);
      return [];
    }
  }

  /**
   * One Open-Meteo call for a batch of coordinates.
   *
   * Returns null on any failure — the caller keeps the previous readings,
   * which is always better than replacing real data with nothing.
   */
  private async fetchBatch(codes: string[]): Promise<OpenMeteoPoint[] | null> {
    const lats = codes.map((c) => CAPITAL_COORDS[c].lat).join(',');
    const lons = codes.map((c) => CAPITAL_COORDS[c].lon).join(',');
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
      `&current=temperature_2m&timezone=UTC`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        this.log.warn(`Open-Meteo returned ${res.status}`);
        return null;
      }
      const body: unknown = await res.json();
      // A single coordinate comes back as an object, several as an array.
      return Array.isArray(body) ? (body as OpenMeteoPoint[]) : [body as OpenMeteoPoint];
    } catch (err: unknown) {
      this.log.warn(`Open-Meteo request failed: ${String(err)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
