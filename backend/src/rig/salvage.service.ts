import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { lockUserRow } from '../common/row-lock';
import { RigService, installedDto } from './rig.service';

/** Parts this close to burning out may be broken down for scrap. */
export const SALVAGE_WINDOW_MS = 3 * 24 * 3_600_000;
/** Scrap needed to craft one random part. */
export const CRAFT_COST = 3;
/** Lifetime of a crafted part. */
export const CRAFT_DURATION_DAYS = 30;

/** Scrap a salvaged part yields, by catalogue tier. */
export function scrapForTier(tier: number): number {
  if (tier >= 5) return 3;
  if (tier >= 3) return 2;
  return 1;
}

/**
 * Crafting odds by tier. Weighted toward the entry parts so crafting is a
 * reason to keep salvaging, not a substitute for buying.
 */
export const CRAFT_WEIGHTS: Record<number, number> = {
  1: 50,
  2: 28,
  3: 15,
  4: 5,
  5: 2,
};

/**
 * Pick an index from `weights` given a 0–1 roll. Pure so the odds can be
 * tested with a fixed roll.
 */
export function weightedPick(weights: number[], roll: number): number {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return 0;
  let cursor = Math.min(Math.max(roll, 0), 0.999_999) * total;
  for (let i = 0; i < weights.length; i += 1) {
    cursor -= Math.max(0, weights[i]);
    if (cursor < 0) return i;
  }
  return weights.length - 1;
}

/**
 * Salvage and crafting: a part about to expire is worth scrap rather than
 * nothing, and three scrap become a random new part. Keeps 30-day parts
 * from reading as a waste once their month is up.
 */
@Injectable()
export class SalvageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rig: RigService,
  ) {}

  async salvage(userId: string, boosterId: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      const part = await tx.booster.findUnique({
        where: { id: boosterId },
        include: { plan: true, slot: true, listing: true },
      });
      if (!part || part.userId !== userId) {
        throw new BadRequestException('That part is not in your inventory.');
      }
      if (part.salvagedAt) {
        throw new BadRequestException('That part has already been salvaged.');
      }
      if (part.listing && part.listing.status === 'ACTIVE') {
        throw new BadRequestException(
          'That part is listed for sale. Cancel the listing first.',
        );
      }

      const expired = part.expiresAt.getTime() <= now.getTime();
      const expiringSoon =
        part.expiresAt.getTime() - now.getTime() <= SALVAGE_WINDOW_MS;
      const burned =
        !!part.disabledUntil && part.disabledUntil.getTime() > now.getTime();
      if (!expired && !expiringSoon && !burned) {
        throw new BadRequestException(
          'Only parts that are burned, expired or within 3 days of expiry can be salvaged.',
        );
      }

      if (part.slot) {
        await tx.rigSlot.delete({ where: { id: part.slot.id } });
      }
      await tx.booster.update({
        where: { id: part.id },
        data: { salvagedAt: now },
      });
      const gained = scrapForTier(part.plan.tier);
      const user = await tx.user.update({
        where: { id: userId },
        data: { scrap: { increment: gained } },
        select: { scrap: true },
      });
      return { scrap: user.scrap, salvagedId: part.id, gained };
    });
  }

  async craft(userId: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { scrap: true },
      });
      if (user.scrap < CRAFT_COST) {
        throw new BadRequestException(
          `Crafting needs ${CRAFT_COST} scrap. You have ${user.scrap}.`,
        );
      }

      const plans = await tx.boosterPlan.findMany({
        where: { active: true, code: { not: null } },
        orderBy: [{ tier: 'asc' }, { priceUsd: 'asc' }],
      });
      if (plans.length === 0) {
        throw new BadRequestException('Nothing can be crafted right now.');
      }

      const weights = plans.map((p) => CRAFT_WEIGHTS[p.tier] ?? 1);
      const plan = plans[weightedPick(weights, Math.random())];

      const booster = await tx.booster.create({
        data: {
          userId,
          planId: plan.id,
          source: 'CRAFT',
          startedAt: now,
          expiresAt: new Date(
            now.getTime() + CRAFT_DURATION_DAYS * 24 * 3_600_000,
          ),
        },
      });
      const updated = await tx.user.update({
        where: { id: userId },
        data: { scrap: { decrement: CRAFT_COST } },
        select: { scrap: true },
      });
      const slot = await this.rig.autoInstall(tx, userId, booster.id);

      return {
        part: installedDto(booster, plan, slot === null ? null : now),
        scrap: updated.scrap,
        slot,
      };
    });
  }
}
