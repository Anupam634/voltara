import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { lockUserRow } from '../common/row-lock';
import {
  OVERCLOCK_BURN_HOURS,
  OVERCLOCK_MAX_HOURS,
  overclockBurnRoll,
  partIsLive,
} from '../mining/rig.engine';
import { RigService } from './rig.service';
import { toEnginePart } from './rig-context.service';

const HOUR_MS = 3_600_000;
/** Users examined per cron run. */
const BATCH = 500;
/** Rolls a single run will catch up on for one user (= max overclock length). */
const MAX_ROLLS_PER_RUN = OVERCLOCK_MAX_HOURS;

/**
 * Overclock: the risk button.
 *
 * Switching it on is instant; the engine applies +40% hash / +80% heat via
 * RigContextService. The cost arrives on the hour: every hour an overclock
 * has been running, one installed part may burn (rig.engine decides the
 * odds). The roll is done here on a schedule rather than at read time so it
 * happens once, whoever is looking.
 */
@Injectable()
export class OverclockService {
  private readonly log = new Logger(OverclockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rig: RigService,
  ) {}

  async set(userId: string, on: boolean) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      if (!on) {
        await tx.user.update({
          where: { id: userId },
          data: { overclockUntil: null, overclockNextRollAt: null },
        });
        return;
      }

      const slots = await tx.rigSlot.findMany({
        where: { userId },
        include: { booster: { include: { plan: true } } },
      });
      const hasLiveCore = slots.some(
        (s) =>
          s.booster.plan.kind === 'CORE' &&
          partIsLive(
            toEnginePart(
              s.booster.plan,
              s.booster.expiresAt,
              s.booster.disabledUntil,
            ),
            now,
          ),
      );
      if (!hasLiveCore) {
        throw new BadRequestException(
          'Install a working core before overclocking — there is nothing to push.',
        );
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          overclockUntil: new Date(now.getTime() + OVERCLOCK_MAX_HOURS * HOUR_MS),
          overclockNextRollAt: new Date(now.getTime() + HOUR_MS),
        },
      });
    });

    return this.rig.overview(userId);
  }

  /** Hourly burn rolls for everyone overclocking, plus expiry of finished runs. */
  @Cron('*/5 * * * *')
  async tick(): Promise<void> {
    const now = new Date();

    // Runs that have ended: clear both fields, no roll.
    await this.prisma.user.updateMany({
      where: { overclockUntil: { not: null, lte: now } },
      data: { overclockUntil: null, overclockNextRollAt: null },
    });

    const due = await this.prisma.user.findMany({
      where: {
        overclockUntil: { gt: now },
        overclockNextRollAt: { lte: now },
      },
      select: { id: true },
      take: BATCH,
    });

    for (const { id } of due) {
      try {
        await this.rollFor(id, now);
      } catch (err) {
        this.log.warn(`overclock roll failed for ${id}: ${String(err)}`);
      }
    }
  }

  /** One user's overdue rolls, serialised on their row. */
  async rollFor(
    userId: string,
    now: Date,
    random: () => number = Math.random,
  ): Promise<{ burned: string[] }> {
    return this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { overclockUntil: true, overclockNextRollAt: true },
      });
      const burned: string[] = [];
      if (
        !user.overclockUntil ||
        !user.overclockNextRollAt ||
        user.overclockUntil.getTime() <= now.getTime()
      ) {
        return { burned };
      }

      let nextRoll = user.overclockNextRollAt;
      let rolls = 0;
      while (
        nextRoll.getTime() <= now.getTime() &&
        nextRoll.getTime() <= user.overclockUntil.getTime() &&
        rolls < MAX_ROLLS_PER_RUN
      ) {
        const slots = await tx.rigSlot.findMany({
          where: { userId },
          include: { booster: { include: { plan: true } } },
        });
        const live = slots.filter((s) =>
          partIsLive(
            toEnginePart(
              s.booster.plan,
              s.booster.expiresAt,
              s.booster.disabledUntil,
            ),
            now,
          ),
        );
        const hit = overclockBurnRoll({
          liveCount: live.length,
          roll: random(),
          pick: random(),
        });
        if (hit !== null) {
          const victim = live[hit].booster;
          await tx.booster.update({
            where: { id: victim.id },
            data: {
              disabledUntil: new Date(
                now.getTime() + OVERCLOCK_BURN_HOURS * HOUR_MS,
              ),
            },
          });
          burned.push(victim.id);
        }
        nextRoll = new Date(nextRoll.getTime() + HOUR_MS);
        rolls += 1;
      }

      await tx.user.update({
        where: { id: userId },
        data: { overclockNextRollAt: nextRoll },
      });
      return { burned };
    });
  }
}
