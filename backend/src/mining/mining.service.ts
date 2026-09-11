import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  effectiveRateMilli,
  accrueMilli,
  canClaim,
  referralTierFor,
  nextStreakDays,
  nextStreakTier,
  streakBonusBp,
  CLAIM_WINDOW_HOURS,
  STREAK_GRACE_HOURS,
} from './mining.engine';
import { type RigTelemetry } from './rig.engine';
import { RigService, telemetryDto } from '../rig/rig.service';
import { RigContextService } from '../rig/rig-context.service';
import { ApprenticeService } from '../apprentice/apprentice.service';
import { lockUserRow } from '../common/row-lock';

/**
 * Orchestrates the mining flow: reads a user's rig + referral count,
 * computes their live rate, and settles a "Mine" tap into the ledger.
 * All the arithmetic lives in mining.engine.ts / rig.engine.ts (pure + tested).
 */
@Injectable()
export class MiningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rig: RigService,
    private readonly rigContext: RigContextService,
    private readonly apprentice: ApprenticeService,
  ) {}

  private async loadInputs(userId: string): Promise<{
    telemetry: RigTelemetry;
    inviteCount: number;
    lastMineAt: Date | null;
    rateAdjustMilli: number;
    streakDays: number;
    bestStreakDays: number;
    rigRunning: boolean;
  }> {
    const [user, telemetry] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          lastMineAt: true,
          rateAdjustMilli: true,
          streakDays: true,
          bestStreakDays: true,
          _count: { select: { referrals: true, installedParts: true } },
        },
      }),
      this.rig.telemetryFor(userId),
    ]);
    return {
      telemetry,
      inviteCount: user._count.referrals,
      lastMineAt: user.lastMineAt,
      rateAdjustMilli: user.rateAdjustMilli,
      streakDays: user.streakDays,
      bestStreakDays: user.bestStreakDays,
      rigRunning: user._count.installedParts > 0,
    };
  }

  /** Live stats for the dashboard (rate, tier, whether a tap is available). */
  async getStatus(userId: string) {
    const {
      telemetry,
      inviteCount,
      lastMineAt,
      rateAdjustMilli,
      streakDays,
      bestStreakDays,
      rigRunning,
    } = await this.loadInputs(userId);
    const rateMilli = effectiveRateMilli({
      rig: telemetry,
      inviteCount,
      rateAdjustMilli,
      streakDays,
    });
    const pending = accrueMilli({ rateMilli, lastMineAt });
    const climbing = nextStreakTier(streakDays);
    return {
      ratePerHour: rateMilli / 1000,
      referralTier: referralTierFor(inviteCount),
      activeBoosters: telemetry.installedCount,
      // The rig readout rides along with every status poll: the dashboard
      // gauge has to move the moment a part is installed or burns out, and
      // making it a second request would let the two drift apart on screen.
      rig: telemetryDto(telemetry),
      pendingPoints: pending / 1000,
      canClaim: canClaim({ lastMineAt }),
      // The dashboard interpolates accrual between polls rather than
      // hammering this endpoint: it needs the cooldown deadline to run a
      // countdown, and the 24h accrual ceiling to know when to stop ticking.
      nextClaimAt: lastMineAt
        ? new Date(lastMineAt.getTime() + CLAIM_WINDOW_HOURS * 3_600_000)
        : null,
      maxPendingPoints: (rateMilli * CLAIM_WINDOW_HOURS) / 1000,
      streak: {
        days: streakDays,
        bestDays: bestStreakDays,
        bonusPercent: streakBonusBp(streakDays) / 100,
        nextTier: climbing
          ? { days: climbing.minDays, bonusPercent: climbing.bonusBp / 100 }
          : null,
        // The moment the run breaks if the miner has not tapped: the
        // cooldown plus the grace window. The dashboard counts down to it.
        keepsUntil: lastMineAt
          ? new Date(
              lastMineAt.getTime() +
                (CLAIM_WINDOW_HOURS + STREAK_GRACE_HOURS) * 3_600_000,
            )
          : null,
      },
      // Derived, never stored: three things a new miner has to do once, and
      // a column for each would only drift from the truth.
      onboarding: {
        claimedFirst: lastMineAt !== null,
        rigRunning,
        invited: inviteCount > 0,
        done: lastMineAt !== null && rigRunning && inviteCount > 0,
      },
    };
  }

  /**
   * Lifetime earnings and recent activity for the dashboard.
   *
   * "Earned" counts only credits (mining, tasks, referrals, airdrops) — a
   * withdrawal debit must not quietly reduce what the user was shown as
   * having earned.
   */
  async history(userId: string, take = 12) {
    // The controller already bounds `take`; this keeps any other caller from
    // pulling the whole ledger by accident.
    take = Math.min(200, Math.max(1, Math.trunc(take) || 12));
    const [credited, entries] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        where: { userId, deltaMilli: { gt: 0 } },
        _sum: { deltaMilli: true },
      }),
      this.prisma.ledgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
      }),
    ]);

    return {
      lifetimeEarnedPoints: Number(credited._sum.deltaMilli ?? 0n) / 1000,
      entries: entries.map((e) => ({
        id: e.id,
        reason: e.reason,
        points: Number(e.deltaMilli) / 1000,
        createdAt: e.createdAt,
      })),
    };
  }

  /**
   * Settle a "Mine" tap: credit accrued points, reset the 24h cooldown.
   *
   * The cooldown is re-read under a lock on the user's row and the credit is
   * written in the same transaction. Checking `canClaim` first and crediting
   * afterwards meant a handful of taps fired together all read the same
   * `lastMineAt`, all passed, and all credited — a full day's mining paid out
   * as many times as the client could get requests in flight.
   */
  async claim(userId: string) {
    const now = new Date();

    const settled = await this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          lastMineAt: true,
          rateAdjustMilli: true,
          rigCoolingBonus: true,
          rigPowerBonus: true,
          streakDays: true,
          bestStreakDays: true,
          _count: { select: { referrals: true } },
        },
      });

      if (!canClaim({ lastMineAt: user.lastMineAt })) {
        throw new BadRequestException('Mining cooldown is still active (24h).');
      }

      // Read the rig inside the same transaction as the credit. Settling
      // against a snapshot taken before the lock would pay out a build the
      // miner had already torn down. Every modifier (event, overclock, squad
      // loan, burned parts) is applied here exactly as the status poll shows.
      const { telemetry } = await this.rigContext.telemetryFor(userId, tx, { now });

      // Settle at the streak the miner ALREADY had. The window being paid
      // for was mined under that run, and extending the streak first would
      // pay today's hours at tomorrow's bonus.
      const rateMilli = effectiveRateMilli({
        rig: telemetry,
        inviteCount: user._count.referrals,
        rateAdjustMilli: user.rateAdjustMilli,
        streakDays: user.streakDays,
      });
      const earned = accrueMilli({ rateMilli, lastMineAt: user.lastMineAt });

      const streakDays = nextStreakDays({
        streakDays: user.streakDays,
        lastMineAt: user.lastMineAt,
        now,
      });
      const bestStreakDays = Math.max(user.bestStreakDays, streakDays);
      const bonusBp = streakBonusBp(streakDays);
      const tierUp = bonusBp > streakBonusBp(user.streakDays);

      await tx.user.update({
        where: { id: userId },
        data: {
          pointsBalance: { increment: BigInt(earned) },
          lastMineAt: now,
          streakDays,
          bestStreakDays,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          userId,
          reason: 'MINING',
          deltaMilli: BigInt(earned),
          meta: {
            rateMilli,
            inviteCount: user._count.referrals,
            gridStability: telemetry.gridStability,
            overclock: telemetry.modifiers.overclock,
            eventHashMultBp: telemetry.modifiers.hashMultBp,
            streakDays,
          },
        },
      });

      // A zero-delta marker, not a credit: the streak is paid as a rate
      // bonus on every future claim, and this row is what lets the
      // dashboard celebrate the moment a tier is reached.
      if (tierUp) {
        await tx.ledgerEntry.create({
          data: {
            userId,
            reason: 'STREAK_BONUS',
            deltaMilli: 0n,
            meta: { streakDays, bonusBp },
          },
        });
      }

      // A mentor's share, if this miner has one. Newly minted on top of
      // `earned`, never taken out of it — see ApprenticeService.creditMentor,
      // which swallows its own failures so a mentor's bonus can never roll
      // back the apprentice's claim.
      const mentorCutMilli = await this.apprentice.creditMentor(
        tx,
        userId,
        earned,
        now,
      );

      return { earned, streakDays, bestStreakDays, bonusBp, tierUp, mentorCutMilli };
    });

    return {
      earnedPoints: settled.earned / 1000,
      nextClaimAt: new Date(now.getTime() + CLAIM_WINDOW_HOURS * 3_600_000),
      streak: {
        days: settled.streakDays,
        bestDays: settled.bestStreakDays,
        bonusPercent: settled.bonusBp / 100,
        // True only on the tap that crossed into a new tier, so the client
        // knows when to fire the celebration rather than guessing.
        tierUp: settled.tierUp,
      },
    };
  }
}
