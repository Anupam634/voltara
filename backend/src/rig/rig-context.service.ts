import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  BP_ONE,
  composeBp,
  poolHeadroom,
  rigTelemetry,
  type RigModifiers,
  type RigPart,
  type RigPartKind,
  type RigTelemetry,
} from '../mining/rig.engine';
import { WeatherService, type WeatherReading } from '../grid/weather.service';
import { CollectiveService } from '../grid/collective.service';

type Client = Prisma.TransactionClient | PrismaService;

/** The grid event in force right now, or null. */
export interface ActiveEvent {
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

/** What the weather where a miner lives is doing to their coolers. */
export interface RigWeather {
  countryCode: string;
  city: string;
  tempC: number;
  heatPercent: number;
}

/** Everything the engine needs about one miner's rig, plus the modifiers. */
export interface RigContext {
  parts: RigPart[];
  coolingBonus: number;
  powerBonus: number;
  modifiers: RigModifiers;
  event: ActiveEvent | null;
  overclockUntil: Date | null;
  squadId: string | null;
  weather: RigWeather | null;
  collectiveBonusBp: number;
}

/**
 * Loads a rig with every modifier applied: the active grid event, the
 * miner's overclock, burned parts, and the cooling / power their squad lends.
 *
 * One place, used by the rig screen, the mining status poll and the claim
 * settlement, so all three always agree on what the rig makes.
 */
@Injectable()
export class RigContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weather: WeatherService,
    private readonly collective: CollectiveService,
  ) {}

  /** The single grid event in force at `now`, if any. */
  async activeEvent(now = new Date(), client: Client = this.prisma): Promise<ActiveEvent | null> {
    const ev = await client.gridEvent.findFirst({
      where: { startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: 'desc' },
    });
    return ev ?? null;
  }

  /** Raw parts and chassis for one miner — no modifiers. */
  async loadParts(userId: string, client: Client = this.prisma) {
    const [user, slots] = await Promise.all([
      client.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          rigCoolingBonus: true,
          rigPowerBonus: true,
          overclockUntil: true,
          squadId: true,
          countryCode: true,
        },
      }),
      client.rigSlot.findMany({
        where: { userId },
        include: { booster: { include: { plan: true } } },
      }),
    ]);
    return {
      user,
      parts: slots.map((s) => toEnginePart(s.booster.plan, s.booster.expiresAt, s.booster.disabledUntil)),
    };
  }

  /**
   * Full context for one miner. `event` may be passed in when the caller
   * already fetched it (a squad computes it once for every member).
   */
  async load(
    userId: string,
    client: Client = this.prisma,
    opts: { now?: Date; event?: ActiveEvent | null; skipSquad?: boolean } = {},
  ): Promise<RigContext> {
    const now = opts.now ?? new Date();
    const [{ user, parts }, event] = await Promise.all([
      this.loadParts(userId, client),
      opts.event === undefined ? this.activeEvent(now, client) : Promise.resolve(opts.event),
    ]);

    const overclock = !!user.overclockUntil && user.overclockUntil.getTime() > now.getTime();

    // Weather and the collective goal scale the same quantities the grid
    // event does, so they compose multiplicatively rather than adding. Both
    // are in-memory lookups: neither touches the network or the database on
    // this path, which is the hot path for every status poll and every claim.
    const reading: WeatherReading | null = this.weather.readingFor(user.countryCode);
    const weatherBp = reading ? reading.heatBp : BP_ONE;
    const collectiveBp = this.collective.bonusBpNow();

    const modifiers: RigModifiers = {
      heatMultBp: composeBp(event?.heatMultBp ?? BP_ONE, weatherBp),
      drawMultBp: event?.drawMultBp ?? BP_ONE,
      hashMultBp: composeBp(event?.hashMultBp ?? BP_ONE, BP_ONE + collectiveBp),
      overclock,
      squadCooling: 0,
      squadPower: 0,
      weatherHeatBp: weatherBp,
      collectiveHashBp: collectiveBp,
    };

    if (user.squadId && !opts.skipSquad) {
      const lent = await this.squadLoan(user.squadId, userId, client, { now, event });
      modifiers.squadCooling = lent.cooling;
      modifiers.squadPower = lent.power;
    }

    return {
      parts,
      coolingBonus: user.rigCoolingBonus,
      powerBonus: user.rigPowerBonus,
      modifiers,
      event,
      overclockUntil: overclock ? user.overclockUntil : null,
      squadId: user.squadId,
      weather: reading
        ? {
            countryCode: reading.countryCode,
            city: reading.city,
            tempC: reading.tempC,
            heatPercent: reading.heatPercent,
          }
        : null,
      collectiveBonusBp: collectiveBp,
    };
  }

  /** Telemetry with every modifier applied. */
  async telemetryFor(
    userId: string,
    client: Client = this.prisma,
    opts: { now?: Date; event?: ActiveEvent | null } = {},
  ): Promise<{ telemetry: RigTelemetry; ctx: RigContext }> {
    const ctx = await this.load(userId, client, opts);
    const telemetry = rigTelemetry({
      parts: ctx.parts,
      chassis: { coolingBonus: ctx.coolingBonus, powerBonus: ctx.powerBonus },
      modifiers: ctx.modifiers,
      now: opts.now,
    });
    return { telemetry, ctx };
  }

  /**
   * What the squad pool lends `userId`.
   *
   * Every member's rig is read WITHOUT the squad modifier (or the loan would
   * feed back into itself), surplus and deficit are pooled, and this member's
   * share comes back. Squads are small (≤5), so the extra reads are cheap.
   */
  async squadLoan(
    squadId: string,
    userId: string,
    client: Client = this.prisma,
    opts: { now?: Date; event?: ActiveEvent | null } = {},
  ): Promise<{ cooling: number; power: number }> {
    const now = opts.now ?? new Date();
    const event = opts.event === undefined ? await this.activeEvent(now, client) : opts.event;
    const members = await client.user.findMany({
      where: { squadId },
      select: { id: true },
    });
    if (members.length < 2) return { cooling: 0, power: 0 };

    const readouts = await Promise.all(
      members.map(async (m) => {
        const ctx = await this.load(m.id, client, { now, event, skipSquad: true });
        const t = rigTelemetry({
          parts: ctx.parts,
          chassis: { coolingBonus: ctx.coolingBonus, powerBonus: ctx.powerBonus },
          modifiers: ctx.modifiers,
          now,
        });
        return { id: m.id, t };
      }),
    );

    const coolingShares = poolHeadroom(
      readouts.map(({ t }) => ({
        surplus: t.coolingSurplus,
        deficit: Math.max(0, t.heatLoad - t.coolingCapacity),
      })),
    );
    const powerShares = poolHeadroom(
      readouts.map(({ t }) => ({
        surplus: t.powerSurplus,
        deficit: Math.max(0, t.powerDraw - t.powerSupply),
      })),
    );
    const i = readouts.findIndex((r) => r.id === userId);
    if (i < 0) return { cooling: 0, power: 0 };
    return { cooling: coolingShares[i], power: powerShares[i] };
  }
}

/** Catalogue row → the shape the pure engine understands. */
export function toEnginePart(
  plan: {
    kind: string;
    rateBonusMilli: number;
    heat: number;
    cooling: number;
    watts: number;
    wattsSupplied: number;
    hashBoostBp: number;
  },
  expiresAt: Date,
  disabledUntil?: Date | null,
): RigPart {
  return {
    kind: plan.kind as RigPartKind,
    hashMilli: plan.rateBonusMilli,
    heat: plan.heat,
    cooling: plan.cooling,
    watts: plan.watts,
    wattsSupplied: plan.wattsSupplied,
    hashBoostBp: plan.hashBoostBp,
    expiresAt,
    disabledUntil: disabledUntil ?? null,
  };
}
