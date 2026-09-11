import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { lockUserRow } from '../common/row-lock';
import {
  CHASSIS_COOLING,
  CHASSIS_WATTS,
  OVERCLOCK_HASH_BP,
  OVERCLOCK_HEAT_BP,
  isValidSlot,
  rigTelemetry,
  slotCount,
  type RigPart,
  type RigTelemetry,
} from '../mining/rig.engine';
import { effectiveRateMilli, referralTierFor } from '../mining/mining.engine';
import { RigContextService, toEnginePart } from './rig-context.service';
import { TtlCache } from '../common/ttl-cache';
import { maskIdentity } from '../common/mask-identity';

/**
 * How long a shared rig card may be stale.
 *
 * Short, because the whole point of the card is that it shows a live build —
 * but not zero, because one popular share can be unfurled by every client
 * that sees the post within a second or two of each other.
 */
const CARD_CACHE_MS = 30_000;

/**
 * How long a spectated rig may be stale.
 *
 * Shorter than the card: a card is a snapshot pasted into a chat, while the
 * watch view is meant to be watched — heat climbing, a slot going dark. Still
 * not zero, because a rig that reaches the top of the leaderboard collects
 * spectators faster than it changes.
 */
const WATCH_CACHE_MS = 15_000;

/**
 * The rig: which owned parts are installed where, and what that build does.
 *
 * Owning a part and running it are deliberately separate. A purchase lands in
 * the inventory and is auto-installed only if a slot is free; from there the
 * miner decides what runs, because slots, cooling and power are all finite.
 * That choice is the product — the mining engine just reads the result.
 */
@Injectable()
export class RigService {
  /** Public rig cards, keyed by referral code. See CARD_CACHE_MS. */
  private readonly cardCache = new TtlCache(CARD_CACHE_MS, 5_000);

  /** Live spectator views, keyed by referral code. See WATCH_CACHE_MS. */
  private readonly watchCache = new TtlCache(WATCH_CACHE_MS, 5_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly context: RigContextService,
  ) {}

  /** Everything the mining engine needs about one miner's installed parts. */
  async loadParts(
    userId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ parts: RigPart[]; coolingBonus: number; powerBonus: number }> {
    const { user, parts } = await this.context.loadParts(userId, client);
    return {
      parts,
      coolingBonus: user.rigCoolingBonus,
      powerBonus: user.rigPowerBonus,
    };
  }

  /**
   * Telemetry for one miner — the gauge the whole UI is built around.
   * Includes every modifier: grid event, overclock, burned parts, squad loan.
   */
  async telemetryFor(
    userId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<RigTelemetry> {
    const { telemetry } = await this.context.telemetryFor(userId, client);
    return telemetry;
  }

  /** The full rig screen: chassis, grid, inventory, telemetry, live rate. */
  async overview(userId: string) {
    const now = new Date();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        rigSlots: true,
        rigCoolingBonus: true,
        rigPowerBonus: true,
        rateAdjustMilli: true,
        rigSkin: true,
        scrap: true,
        squadId: true,
        _count: { select: { referrals: true } },
      },
    });
    const ctx = await this.context.load(userId, this.prisma, { now });

    const [slots, owned] = await Promise.all([
      this.prisma.rigSlot.findMany({
        where: { userId },
        orderBy: { index: 'asc' },
        include: { booster: { include: { plan: true } } },
      }),
      this.prisma.booster.findMany({
        where: { userId, expiresAt: { gt: now }, slot: null, salvagedAt: null, listing: null },
        orderBy: { expiresAt: 'asc' },
        include: { plan: true },
      }),
    ]);

    const total = slotCount(user.rigSlots);
    const chassis = { coolingBonus: user.rigCoolingBonus, powerBonus: user.rigPowerBonus };
    const telemetry = rigTelemetry({ parts: ctx.parts, chassis, modifiers: ctx.modifiers, now });
    // The same build with the overclock off / on, so the toggle can show
    // exactly what it buys and what it costs before the miner commits.
    const unmodified = rigTelemetry({
      parts: ctx.parts,
      chassis,
      modifiers: { ...ctx.modifiers, overclock: false },
      now,
    });
    const overclocked = rigTelemetry({
      parts: ctx.parts,
      chassis,
      modifiers: { ...ctx.modifiers, overclock: true },
      now,
    });

    const rateMilli = effectiveRateMilli({
      rig: telemetry,
      inviteCount: user._count.referrals,
      rateAdjustMilli: user.rateAdjustMilli,
    });

    // What the same build would earn with the penalties lifted. The gap
    // between the two numbers is the entire argument for buying a cooler.
    const potentialMilli = effectiveRateMilli({
      rig: { ...telemetry, thermalEfficiency: 1, powerEfficiency: 1 },
      inviteCount: user._count.referrals,
      rateAdjustMilli: user.rateAdjustMilli,
    });

    const bySlot = new Map(slots.map((s) => [s.index, s]));

    const rateFor = (t: RigTelemetry) =>
      effectiveRateMilli({
        rig: t,
        inviteCount: user._count.referrals,
        rateAdjustMilli: user.rateAdjustMilli,
      }) / 1000;

    return {
      chassis: {
        slots: total,
        baseCooling: CHASSIS_COOLING + user.rigCoolingBonus,
        basePower: CHASSIS_WATTS + user.rigPowerBonus,
        bonusCooling: user.rigCoolingBonus,
        bonusPower: user.rigPowerBonus,
        skin: user.rigSkin,
      },
      grid: Array.from({ length: total }, (_, index) => {
        const s = bySlot.get(index);
        return {
          index,
          part: s ? installedDto(s.booster, s.booster.plan, s.installedAt) : null,
        };
      }),
      inventory: owned.map((b) => installedDto(b, b.plan, null)),
      telemetry: telemetryDto(telemetry),
      scrap: user.scrap,
      squadId: user.squadId,
      weather: ctx.weather,
      collective: {
        bonusPercent: Math.round(ctx.collectiveBonusBp / 100),
        holding: ctx.collectiveBonusBp > 0,
      },
      event: ctx.event
        ? {
            id: ctx.event.id,
            code: ctx.event.code,
            title: ctx.event.title,
            body: ctx.event.body,
            heatMultBp: ctx.event.heatMultBp,
            drawMultBp: ctx.event.drawMultBp,
            hashMultBp: ctx.event.hashMultBp,
            startsAt: ctx.event.startsAt,
            endsAt: ctx.event.endsAt,
          }
        : null,
      overclock: {
        active: ctx.modifiers.overclock ?? false,
        until: ctx.overclockUntil,
        hashBoostPercent: (OVERCLOCK_HASH_BP - 10_000) / 100,
        heatPercent: (OVERCLOCK_HEAT_BP - 10_000) / 100,
        // What the toggle would do to the live rate, either direction.
        rateOff: rateFor(unmodified),
        rateOn: rateFor(overclocked),
        stabilityOff: unmodified.gridStability,
        stabilityOn: overclocked.gridStability,
      },
      rate: {
        ratePerHour: rateMilli / 1000,
        potentialRatePerHour: potentialMilli / 1000,
        throttledAwayPerHour: (potentialMilli - rateMilli) / 1000,
        referralTier: referralTierFor(user._count.referrals),
      },
    };
  }

  /**
   * The public rig card behind a share link.
   *
   * This is the only place a miner's build is readable without their token,
   * so it is deliberately narrow: a masked handle, the shape of the build,
   * and the two numbers that make it worth showing. No email, no balance, no
   * inventory, nothing about money.
   *
   * Stability comes through RigContextService, so the card shows the same
   * figure the miner sees on their own rig — including a live grid event.
   * A card that flattered the build would be a lie the moment someone
   * clicked through.
   */
  async cardFor(referralCode: string) {
    const code = referralCode.trim();
    if (!code) return null;
    return this.cardCache.wrap(`card:${code}`, () => this.buildCard(code));
  }

  /**
   * A rig anyone may watch: the card, plus the live readout behind it.
   *
   * Same masked identity and the same "a blocked account reads as missing"
   * rule as the card — a leaderboard row that outlives a ban must not become
   * a way to confirm the ban.
   */
  async watchFor(referralCode: string) {
    const code = referralCode.trim();
    if (!code) return null;
    return this.watchCache.wrap(`watch:${code}`, () => this.buildWatch(code));
  }

  private async buildWatch(referralCode: string) {
    const loaded = await this.loadPublicRig(referralCode);
    if (!loaded) return null;
    const { user, telemetry, rateMilli, slots, total, ctx } = loaded;

    // A slot runs hot when the part in it makes heat and the rig as a whole
    // is over its cooling budget. Derived rather than stored: there is no
    // per-part thermal reading, and inventing one would be a second source
    // of truth for a number the engine already settles.
    const makesHeat = (kind: string) => kind === 'CORE' || kind === 'PSU';
    const bySlot = new Map(slots.map((x) => [x.index, x]));

    return {
      ...this.cardProjection(loaded),
      telemetry: {
        gridStability: telemetry.gridStability,
        heatLoad: telemetry.heatLoad,
        coolingCapacity: telemetry.coolingCapacity,
        powerDraw: telemetry.powerDraw,
        powerSupply: telemetry.powerSupply,
        thermalEfficiency: telemetry.thermalEfficiency,
        powerEfficiency: telemetry.powerEfficiency,
        overheating: telemetry.overheating,
        brownout: telemetry.brownout,
        installedCount: telemetry.installedCount,
        disabledCount: telemetry.disabledCount,
      },
      overclocking: telemetry.modifiers.overclock,
      slotsDetail: Array.from({ length: total }, (_, index) => {
        const x = bySlot.get(index);
        if (!x) return null;
        const plan = x.booster.plan;
        const burned =
          !!x.booster.disabledUntil &&
          x.booster.disabledUntil.getTime() > Date.now();
        return {
          index,
          kind: plan.kind,
          code: plan.code,
          name: plan.name ?? `$${plan.priceUsd} part`,
          tier: plan.tier,
          heat: plan.heat,
          cooling: plan.cooling,
          watts: plan.watts,
          wattsSupplied: plan.wattsSupplied,
          hot: telemetry.overheating && makesHeat(plan.kind) && plan.heat > 0,
          burned,
        };
      }),
      event: ctx.event
        ? {
            code: ctx.event.code,
            title: ctx.event.title,
            endsAt: ctx.event.endsAt,
          }
        : null,
      ratePerHour: rateMilli / 1000,
      slots: Array.from({ length: total }, (_, index) => {
        const x = bySlot.get(index);
        if (!x) return null;
        return {
          kind: x.booster.plan.kind,
          code: x.booster.plan.code,
          name: x.booster.plan.name ?? `$${x.booster.plan.priceUsd} part`,
          tier: x.booster.plan.tier,
        };
      }),
      name: maskIdentity({ id: user.id, email: user.email }),
    };
  }

  private async buildCard(referralCode: string) {
    const loaded = await this.loadPublicRig(referralCode);
    if (!loaded) return null;
    return this.cardProjection(loaded);
  }

  /**
   * Everything the two public views share: the account, its live telemetry,
   * its rate and its installed parts.
   *
   * One loader so the card and the watch view can never disagree about a
   * rig's stability, which is the number both of them lead with.
   */
  private async loadPublicRig(referralCode: string) {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { referralCode },
      select: {
        id: true,
        email: true,
        countryCode: true,
        isBlocked: true,
        createdAt: true,
        rigSlots: true,
        rigCoolingBonus: true,
        rigPowerBonus: true,
        rateAdjustMilli: true,
        rigSkin: true,
        streakDays: true,
        _count: { select: { referrals: true } },
      },
    });
    // A blocked account reads as missing rather than as an error: a share
    // link that outlives a ban should degrade to the generic card.
    if (!user || user.isBlocked) return null;

    const ctx = await this.context.load(user.id, this.prisma, { now });
    const telemetry = rigTelemetry({
      parts: ctx.parts,
      chassis: {
        coolingBonus: user.rigCoolingBonus,
        powerBonus: user.rigPowerBonus,
      },
      modifiers: ctx.modifiers,
      now,
    });

    const rateMilli = effectiveRateMilli({
      rig: telemetry,
      inviteCount: user._count.referrals,
      rateAdjustMilli: user.rateAdjustMilli,
      streakDays: user.streakDays,
    });

    const slots = await this.prisma.rigSlot.findMany({
      where: { userId: user.id },
      orderBy: { index: 'asc' },
      include: { booster: { include: { plan: true } } },
    });

    return {
      user,
      ctx,
      telemetry,
      rateMilli,
      slots,
      total: slotCount(user.rigSlots),
    };
  }

  /** The card subset of a loaded public rig. */
  private cardProjection(loaded: {
    user: {
      id: string;
      email: string | null;
      countryCode: string | null;
      createdAt: Date;
      rigSkin: string;
      streakDays: number;
    };
    telemetry: RigTelemetry;
    rateMilli: number;
    slots: { index: number; booster: { plan: { kind: string; code: string | null; name: string | null; priceUsd: number; tier: number } } }[];
    total: number;
  }) {
    const { user, telemetry, rateMilli, slots, total } = loaded;
    const bySlot = new Map(slots.map((s) => [s.index, s]));

    return {
      name: maskIdentity({ id: user.id, email: user.email }),
      countryCode: user.countryCode,
      ratePerHour: rateMilli / 1000,
      gridStability: telemetry.gridStability,
      slots: Array.from({ length: total }, (_, index) => {
        const s = bySlot.get(index);
        if (!s) return null;
        return {
          kind: s.booster.plan.kind,
          code: s.booster.plan.code,
          name: s.booster.plan.name ?? `$${s.booster.plan.priceUsd} part`,
          tier: s.booster.plan.tier,
        };
      }),
      partCount: telemetry.installedCount,
      skin: user.rigSkin,
      streakDays: user.streakDays,
      joinedAt: user.createdAt,
    };
  }

  /**
   * Socket an owned part into a slot.
   *
   * Serialised on the user's row: two installs racing for the last free slot
   * both read it as empty, and the unique index on (userId, index) would turn
   * the loser into a 500 rather than the "that slot is taken" a miner can act
   * on. The lock also keeps a swap (uninstall + install) from interleaving
   * with a purchase's auto-install and landing two parts in one slot.
   */
  async install(userId: string, boosterId: string, index: number) {
    return this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { rigSlots: true },
      });
      const total = slotCount(user.rigSlots);
      if (!isValidSlot(index, total)) {
        throw new BadRequestException(
          `Slot ${index} is not on this rig (it has ${total}).`,
        );
      }

      const part = await tx.booster.findUnique({
        where: { id: boosterId },
        include: { plan: true, slot: true },
      });
      if (!part || part.userId !== userId) {
        throw new BadRequestException('That part is not in your inventory.');
      }
      if (part.expiresAt <= new Date()) {
        throw new BadRequestException('That part has burned out.');
      }
      if (part.slot) {
        throw new BadRequestException(
          `That part is already installed in slot ${part.slot.index + 1}.`,
        );
      }

      const occupant = await tx.rigSlot.findUnique({
        where: { userId_index: { userId, index } },
      });
      if (occupant) {
        throw new BadRequestException(
          `Slot ${index + 1} is occupied. Remove that part first.`,
        );
      }

      await tx.rigSlot.create({ data: { userId, index, boosterId } });
      return { installed: true, index, telemetry: await this.telemetryFor(userId, tx) };
    });
  }

  /** Pull a part out of a slot. It stays owned, and stops earning. */
  async uninstall(userId: string, index: number) {
    return this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      const slot = await tx.rigSlot.findUnique({
        where: { userId_index: { userId, index } },
      });
      if (!slot) {
        throw new BadRequestException(`Slot ${index + 1} is already empty.`);
      }

      await tx.rigSlot.delete({ where: { id: slot.id } });
      return {
        uninstalled: true,
        index,
        boosterId: slot.boosterId,
        telemetry: await this.telemetryFor(userId, tx),
      };
    });
  }

  /**
   * Install a freshly purchased part if the rig has room.
   *
   * Called from the purchase pipeline so the common case — buy a part, watch
   * the rate move — needs no second step. A full rig leaves it in inventory
   * rather than evicting something the miner chose to run.
   *
   * Never throws: a purchase that is already paid for must not fail because
   * of where its part ended up.
   */
  async autoInstall(
    tx: Prisma.TransactionClient,
    userId: string,
    boosterId: string,
  ): Promise<number | null> {
    try {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { rigSlots: true },
      });
      const total = slotCount(user.rigSlots);
      const taken = new Set(
        (
          await tx.rigSlot.findMany({
            where: { userId },
            select: { index: true },
          })
        ).map((s) => s.index),
      );
      for (let index = 0; index < total; index += 1) {
        if (taken.has(index)) continue;
        await tx.rigSlot.create({ data: { userId, index, boosterId } });
        return index;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export { toEnginePart };

export function telemetryDto(t: RigTelemetry) {
  return {
    hashPerHour: t.hashMilli / 1000,
    baseHashPerHour: t.baseHashMilli / 1000,
    heatLoad: t.heatLoad,
    coolingCapacity: t.coolingCapacity,
    powerDraw: t.powerDraw,
    powerSupply: t.powerSupply,
    thermalEfficiency: t.thermalEfficiency,
    powerEfficiency: t.powerEfficiency,
    gridStability: t.gridStability,
    overheating: t.overheating,
    brownout: t.brownout,
    installedCount: t.installedCount,
    disabledCount: t.disabledCount,
    coolingSurplus: t.coolingSurplus,
    powerSurplus: t.powerSurplus,
    modifiers: {
      heatMultBp: t.modifiers.heatMultBp,
      drawMultBp: t.modifiers.drawMultBp,
      hashMultBp: t.modifiers.hashMultBp,
      overclock: t.modifiers.overclock,
      squadCooling: t.modifiers.squadCooling,
      squadPower: t.modifiers.squadPower,
      weatherHeatBp: t.modifiers.weatherHeatBp,
      collectiveHashBp: t.modifiers.collectiveHashBp,
    },
  };
}

/** One owned part, whether it is in the grid or waiting in inventory. */
export function installedDto(
  booster: { id: string; expiresAt: Date; startedAt: Date; source?: string; disabledUntil?: Date | null },
  plan: {
    id: string;
    code: string | null;
    name: string | null;
    kind: string;
    priceUsd: number;
    rateBonusMilli: number;
    heat: number;
    cooling: number;
    watts: number;
    wattsSupplied: number;
    hashBoostBp: number;
    tier: number;
  },
  installedAt: Date | null,
) {
  return {
    id: booster.id,
    planId: plan.id,
    code: plan.code,
    name: plan.name ?? `$${plan.priceUsd} part`,
    kind: plan.kind,
    tier: plan.tier,
    priceUsd: plan.priceUsd,
    hashPerHour: plan.rateBonusMilli / 1000,
    heat: plan.heat,
    cooling: plan.cooling,
    watts: plan.watts,
    wattsSupplied: plan.wattsSupplied,
    hashBoostPercent: plan.hashBoostBp / 100,
    startedAt: booster.startedAt,
    expiresAt: booster.expiresAt,
    installedAt,
    source: booster.source ?? 'PURCHASE',
    disabledUntil: booster.disabledUntil ?? null,
    burned: !!booster.disabledUntil && booster.disabledUntil.getTime() > Date.now(),
  };
}
