import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { TtlCache } from '../common/ttl-cache';
import { rigTelemetry, type RigPart, type RigPartKind } from '../mining/rig.engine';
import {
  bpToPercent,
  pickNextCode,
  scheduleWindow,
  specFor,
  type GridEventCode,
} from './grid-events.catalog';

/** Whole-map aggregate: recomputed at most once a minute. */
const MAP_TTL_MS = 60_000;
/** A rig is "active" if its miner tapped inside this window. */
const ACTIVE_WINDOW_MS = 7 * 24 * 3_600_000;
/** "Online now" = tapped within the last hour. */
const ONLINE_WINDOW_MS = 60 * 60_000;
/** Bound on the per-rig telemetry pass behind the map. */
const MAP_USER_CAP = 5_000;
/** Window for the "VOLTS mined" counter on the landing strip. */
const MINED_WINDOW_MS = 24 * 3_600_000;

export interface EventDto {
  id: string;
  code: string;
  title: string;
  body: string;
  heatMultBp: number;
  drawMultBp: number;
  hashMultBp: number;
  startsAt: Date;
  endsAt: Date;
  heatPercent: number;
  drawPercent: number;
  hashPercent: number;
}

interface EventRow {
  id: string;
  code: string;
  title: string;
  body: string;
  heatMultBp: number;
  drawMultBp: number;
  hashMultBp: number;
  startsAt: Date;
  endsAt: Date;
}

export function eventDto(e: EventRow): EventDto {
  return {
    id: e.id,
    code: e.code,
    title: e.title,
    body: e.body,
    heatMultBp: e.heatMultBp,
    drawMultBp: e.drawMultBp,
    hashMultBp: e.hashMultBp,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    heatPercent: bpToPercent(e.heatMultBp),
    drawPercent: bpToPercent(e.drawMultBp),
    hashPercent: bpToPercent(e.hashMultBp),
  };
}

export interface CountryMapEntry {
  code: string;
  miners: number;
  active: number;
  stablePercent: number;
}

/** The measured counters the public landing strip renders. */
export interface GridStatsDto {
  miners: number;
  activeRigs: number;
  onlineNow: number;
  countries: number;
  stablePercent: number;
  /** VOLTS credited by mining in the last 24h, in whole points. */
  voltsMined24h: number;
  updatedAt: Date;
}

export interface GridMapDto {
  totalRigs: number;
  activeRigs: number;
  stablePercent: number;
  onlineNow: number;
  countries: CountryMapEntry[];
  updatedAt: Date;
}

/** One rig's contribution to the map, before it is rolled up by country. */
interface MapRig {
  countryCode: string | null;
  active: boolean;
  stable: boolean;
}

/**
 * Pure roll-up of per-rig rows into the map payload. Exported so the
 * aggregation is unit-testable without a database.
 */
export function rollUpMap(rigs: MapRig[], onlineNow: number, updatedAt: Date): GridMapDto {
  const byCountry = new Map<string, { miners: number; active: number; stable: number }>();
  let activeRigs = 0;
  let stableActive = 0;

  for (const r of rigs) {
    if (r.active) {
      activeRigs += 1;
      if (r.stable) stableActive += 1;
    }
    if (!r.countryCode) continue;
    const c = byCountry.get(r.countryCode) ?? { miners: 0, active: 0, stable: 0 };
    c.miners += 1;
    if (r.active) {
      c.active += 1;
      if (r.stable) c.stable += 1;
    }
    byCountry.set(r.countryCode, c);
  }

  const countries: CountryMapEntry[] = Array.from(byCountry.entries())
    .map(([code, c]) => ({
      code,
      miners: c.miners,
      active: c.active,
      stablePercent: c.active > 0 ? Math.round((c.stable / c.active) * 100) : 100,
    }))
    .sort((a, b) => b.active - a.active || b.miners - a.miners || a.code.localeCompare(b.code));

  return {
    totalRigs: rigs.length,
    activeRigs,
    stablePercent: activeRigs > 0 ? Math.round((stableActive / activeRigs) * 100) : 100,
    onlineNow,
    countries,
    updatedAt,
  };
}

@Injectable()
export class GridService implements OnModuleInit {
  private readonly log = new Logger(GridService.name);
  private readonly cache = new TtlCache(MAP_TTL_MS, 8);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureScheduled().catch((err: unknown) => {
      this.log.warn(`Could not schedule the first grid event: ${String(err)}`);
    });
  }

  /** Every 15 minutes: make sure something is on the calendar. */
  @Cron('*/15 * * * *')
  async tick(): Promise<void> {
    await this.ensureScheduled().catch((err: unknown) => {
      this.log.warn(`Grid event scheduler tick failed: ${String(err)}`);
    });
  }

  /**
   * If nothing is active or upcoming, roll the next event.
   *
   * Two instances can both see an empty calendar and both try to fill it;
   * the check is repeated inside a serialisable transaction so only one
   * insert survives.
   */
  async ensureScheduled(now = new Date()): Promise<EventDto | null> {
    const pending = await this.prisma.gridEvent.findFirst({
      where: { endsAt: { gt: now } },
      select: { id: true },
    });
    if (pending) return null;

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          const again = await tx.gridEvent.findFirst({
            where: { endsAt: { gt: now } },
            select: { id: true },
          });
          if (again) return null;

          const last = await tx.gridEvent.findFirst({
            orderBy: { startsAt: 'desc' },
            select: { code: true },
          });
          const code = pickNextCode(last?.code ?? null);
          const spec = specFor(code);
          if (!spec) return null;
          const { startsAt, endsAt } = scheduleWindow(now);

          return tx.gridEvent.create({
            data: {
              code: spec.code,
              title: spec.title,
              body: spec.body,
              heatMultBp: spec.heatMultBp,
              drawMultBp: spec.drawMultBp,
              hashMultBp: spec.hashMultBp,
              startsAt,
              endsAt,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
      if (created) {
        this.log.log(`Scheduled grid event ${created.code} for ${created.startsAt.toISOString()}`);
        return eventDto(created);
      }
      return null;
    } catch (err: unknown) {
      // The other instance won the race — its row is the schedule.
      this.log.debug(`Grid event scheduling lost a race: ${String(err)}`);
      return null;
    }
  }

  /**
   * Start an event immediately (admin hook — not routed yet). Ends anything
   * currently running so at most one event is ever in force.
   */
  async startNow(code: GridEventCode, hours = 6, now = new Date()): Promise<EventDto> {
    const spec = specFor(code);
    if (!spec) throw new Error(`Unknown grid event code: ${code}`);
    const endsAt = new Date(now.getTime() + Math.max(1, hours) * 3_600_000);

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.gridEvent.updateMany({
        where: { startsAt: { lte: now }, endsAt: { gt: now } },
        data: { endsAt: now },
      });
      // A future event would collide with this one; push it past the end.
      const upcoming = await tx.gridEvent.findMany({
        where: { startsAt: { gt: now }, endsAt: { gt: now } },
        select: { id: true, startsAt: true, endsAt: true },
      });
      for (const u of upcoming) {
        if (u.startsAt < endsAt) {
          const shift = endsAt.getTime() - u.startsAt.getTime() + 60_000;
          await tx.gridEvent.update({
            where: { id: u.id },
            data: {
              startsAt: new Date(u.startsAt.getTime() + shift),
              endsAt: new Date(u.endsAt.getTime() + shift),
            },
          });
        }
      }
      return tx.gridEvent.create({
        data: {
          code: spec.code,
          title: spec.title,
          body: spec.body,
          heatMultBp: spec.heatMultBp,
          drawMultBp: spec.drawMultBp,
          hashMultBp: spec.hashMultBp,
          startsAt: now,
          endsAt,
        },
      });
    });
    return eventDto(created);
  }

  /** GET /api/grid/event */
  async eventBoard(now = new Date()) {
    const [active, upcoming, recent] = await Promise.all([
      this.prisma.gridEvent.findFirst({
        where: { startsAt: { lte: now }, endsAt: { gt: now } },
        orderBy: { startsAt: 'desc' },
      }),
      this.prisma.gridEvent.findFirst({
        where: { startsAt: { gt: now } },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.gridEvent.findMany({
        where: { endsAt: { lte: now } },
        orderBy: { endsAt: 'desc' },
        take: 5,
      }),
    ]);
    return {
      active: active ? eventDto(active) : null,
      upcoming: upcoming ? eventDto(upcoming) : null,
      recent: recent.map(eventDto),
      serverTime: now.toISOString(),
    };
  }

  /** GET /api/grid/map — cached for a minute. */
  map(): Promise<GridMapDto> {
    return this.cache.wrap('map', () => this.computeMap());
  }

  /**
   * GET /api/grid/stats — the counters under the landing hero.
   *
   * Every number here is measured, not seeded. The strip this feeds used to
   * invent payouts and wallet addresses on a timer, which is exactly the
   * kind of thing a miner checks before trusting a payout page. Five real
   * counters that are sometimes small beat eight fake ones that are always
   * impressive.
   *
   * Shares the map's cache key space and TTL: it is the same aggregate plus
   * one indexed sum, and the landing page is the most-hit route there is.
   */
  stats(): Promise<GridStatsDto> {
    return this.cache.wrap('stats', () => this.computeStats());
  }

  private async computeStats(): Promise<GridStatsDto> {
    const since = new Date(Date.now() - MINED_WINDOW_MS);

    const [map, mined] = await Promise.all([
      this.map(),
      this.prisma.ledgerEntry.aggregate({
        _sum: { deltaMilli: true },
        where: { reason: 'MINING', createdAt: { gte: since } },
      }),
    ]);

    return {
      miners: map.totalRigs,
      activeRigs: map.activeRigs,
      onlineNow: map.onlineNow,
      countries: map.countries.length,
      stablePercent: map.stablePercent,
      voltsMined24h: Number(mined._sum.deltaMilli ?? 0n) / 1000,
      updatedAt: map.updatedAt,
    };
  }

  private async computeMap(): Promise<GridMapDto> {
    const now = new Date();
    const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_MS);
    const onlineSince = new Date(now.getTime() - ONLINE_WINDOW_MS);

    const [totalRigs, onlineNow, users] = await Promise.all([
      this.prisma.user.count({ where: { isBlocked: false } }),
      this.prisma.user.count({
        where: { isBlocked: false, lastMineAt: { gte: onlineSince } },
      }),
      this.prisma.user.findMany({
        where: { isBlocked: false },
        orderBy: { lastMineAt: { sort: 'desc', nulls: 'last' } },
        take: MAP_USER_CAP,
        select: {
          countryCode: true,
          lastMineAt: true,
          rigCoolingBonus: true,
          rigPowerBonus: true,
          installedParts: {
            select: {
              booster: {
                select: {
                  expiresAt: true,
                  disabledUntil: true,
                  plan: {
                    select: {
                      kind: true,
                      rateBonusMilli: true,
                      heat: true,
                      cooling: true,
                      watts: true,
                      wattsSupplied: true,
                      hashBoostBp: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const rigs: MapRig[] = users.map((u) => {
      const active = !!u.lastMineAt && u.lastMineAt.getTime() >= activeSince.getTime();
      let stable = true;
      if (active && u.installedParts.length > 0) {
        const parts: RigPart[] = u.installedParts.map((s) => ({
          kind: s.booster.plan.kind as RigPartKind,
          hashMilli: s.booster.plan.rateBonusMilli,
          heat: s.booster.plan.heat,
          cooling: s.booster.plan.cooling,
          watts: s.booster.plan.watts,
          wattsSupplied: s.booster.plan.wattsSupplied,
          hashBoostBp: s.booster.plan.hashBoostBp,
          expiresAt: s.booster.expiresAt,
          disabledUntil: s.booster.disabledUntil,
        }));
        stable =
          rigTelemetry({
            parts,
            chassis: { coolingBonus: u.rigCoolingBonus, powerBonus: u.rigPowerBonus },
            now,
          }).gridStability === 100;
      }
      return { countryCode: u.countryCode, active, stable };
    });

    const rolled = rollUpMap(rigs, onlineNow, now);
    // The capped scan may not have seen every miner; the headline count is
    // the true total, the per-country rows are what the scan covered.
    return { ...rolled, totalRigs };
  }
}
