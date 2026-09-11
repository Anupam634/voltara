import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, type Duel, type DuelStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RigContextService } from '../rig/rig-context.service';
import { lockUserRow } from '../common/row-lock';
import { publicRigReadout } from '../common/rig-readout';
import {
  DEFAULT_STAKE_BP,
  DUEL_OPEN_TTL_HOURS,
  DUEL_WINDOW_HOURS,
  BP_ONE,
  settleDuel,
} from './duels.engine';

const MILLI = 1000;
const HOUR_MS = 3_600_000;

export interface DuelSideDto {
  id: string;
  name: string;
  ratePerHour: number;
  gridStability: number;
  countryCode: string | null;
}

export interface DuelDto {
  id: string;
  code: string;
  status: DuelStatus;
  stakeBp: number;
  stakePercent: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  challenger: DuelSideDto;
  opponent: DuelSideDto | null;
  winnerId: string | null;
  transferPoints: number;
  liveScore: { challenger: number; opponent: number };
  mine: 'challenger' | 'opponent' | null;
}

/**
 * Rig duels: a 24h output race between two rigs, started from a share link.
 *
 * The score is what each side MINED inside the window (MINING ledger
 * credits), so a duel rewards keeping the rig stable and tapping on time,
 * not buying parts mid-race. The loser forfeits a slice of their own
 * in-window score to the winner; settlement runs on a cron and is
 * serialised on both user rows.
 */
@Injectable()
export class DuelsService {
  private readonly log = new Logger(DuelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rig: RigContextService,
  ) {}

  // ── Commands ──────────────────────────────────────────────────────────

  async create(userId: string): Promise<DuelDto> {
    const duel = await this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);
      const busy = await tx.duel.findFirst({
        where: {
          status: { in: ['OPEN', 'ACTIVE'] },
          OR: [{ challengerId: userId }, { opponentId: userId }],
        },
        select: { id: true, status: true },
      });
      if (busy) {
        throw new BadRequestException(
          busy.status === 'OPEN'
            ? 'You already have an open challenge. Cancel it or wait for an opponent.'
            : 'You are already in a duel. Wait for it to settle.',
        );
      }
      return tx.duel.create({
        data: { challengerId: userId, stakeBp: DEFAULT_STAKE_BP },
      });
    });
    return this.toDto(duel, userId);
  }

  async accept(userId: string, code: string): Promise<DuelDto> {
    const duel = await this.prisma.$transaction(async (tx) => {
      const found = await tx.duel.findUnique({ where: { code } });
      if (!found) throw new NotFoundException('That duel does not exist.');
      // Lock both rows in a stable order so two racing accepts, or an
      // accept racing a settlement, cannot deadlock.
      for (const id of [found.challengerId, userId].sort()) {
        await lockUserRow(tx, id);
      }
      const fresh = await tx.duel.findUniqueOrThrow({ where: { id: found.id } });
      if (fresh.status !== 'OPEN') {
        throw new BadRequestException('That duel is no longer open.');
      }
      if (fresh.challengerId === userId) {
        throw new BadRequestException('You cannot accept your own challenge.');
      }
      const me = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { isBlocked: true },
      });
      if (me.isBlocked) throw new BadRequestException('This account cannot duel.');

      const active = await tx.duel.findFirst({
        where: {
          status: 'ACTIVE',
          OR: [{ challengerId: userId }, { opponentId: userId }],
        },
        select: { id: true },
      });
      if (active) {
        throw new BadRequestException('You are already in a duel. Wait for it to settle.');
      }
      // Accepting also cancels any open challenge of your own: one duel at a time.
      await tx.duel.updateMany({
        where: { challengerId: userId, status: 'OPEN' },
        data: { status: 'CANCELLED' },
      });

      const now = new Date();
      return tx.duel.update({
        where: { id: fresh.id },
        data: {
          opponentId: userId,
          status: 'ACTIVE',
          startsAt: now,
          endsAt: new Date(now.getTime() + DUEL_WINDOW_HOURS * HOUR_MS),
        },
      });
    });
    return this.toDto(duel, userId);
  }

  async cancel(userId: string, code: string): Promise<DuelDto> {
    const duel = await this.prisma.duel.findUnique({ where: { code } });
    if (!duel) throw new NotFoundException('That duel does not exist.');
    if (duel.challengerId !== userId) {
      throw new BadRequestException('Only the challenger can cancel a duel.');
    }
    if (duel.status !== 'OPEN') {
      throw new BadRequestException('Only an open challenge can be cancelled.');
    }
    const updated = await this.prisma.duel.update({
      where: { id: duel.id },
      data: { status: 'CANCELLED' },
    });
    return this.toDto(updated, userId);
  }

  // ── Queries ───────────────────────────────────────────────────────────

  async mine(userId: string) {
    const involved: Prisma.DuelWhereInput = {
      OR: [{ challengerId: userId }, { opponentId: userId }],
    };
    const [open, active, history] = await Promise.all([
      this.prisma.duel.findFirst({
        where: { ...involved, status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.duel.findFirst({
        where: { ...involved, status: 'ACTIVE' },
        orderBy: { startsAt: 'desc' },
      }),
      this.prisma.duel.findMany({
        where: { ...involved, status: { in: ['SETTLED', 'EXPIRED', 'CANCELLED'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    const [openDto, activeDto, historyDtos] = await Promise.all([
      open ? this.toDto(open, userId) : null,
      active ? this.toDto(active, userId) : null,
      Promise.all(history.map((d) => this.toDto(d, userId))),
    ]);
    return { open: openDto, active: activeDto, history: historyDtos };
  }

  /** Public preview for the share link. */
  async preview(code: string): Promise<DuelDto> {
    const duel = await this.prisma.duel.findUnique({ where: { code } });
    if (!duel) throw new NotFoundException('That duel does not exist.');
    return this.toDto(duel, null);
  }

  // ── Settlement ────────────────────────────────────────────────────────

  @Cron('*/5 * * * *')
  async settleDue(): Promise<void> {
    const now = new Date();

    await this.prisma.duel.updateMany({
      where: {
        status: 'OPEN',
        createdAt: { lte: new Date(now.getTime() - DUEL_OPEN_TTL_HOURS * HOUR_MS) },
      },
      data: { status: 'EXPIRED' },
    });

    const due = await this.prisma.duel.findMany({
      where: { status: 'ACTIVE', endsAt: { lte: now } },
      select: { id: true },
      take: 200,
    });
    for (const { id } of due) {
      try {
        await this.settleOne(id);
      } catch (err) {
        this.log.error(`Settling duel ${id} failed: ${String(err)}`);
      }
    }
  }

  /** Settle one ended duel. Idempotent: a second call finds it SETTLED. */
  async settleOne(duelId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const head = await tx.duel.findUnique({ where: { id: duelId } });
      if (!head || head.status !== 'ACTIVE' || !head.opponentId) return;

      for (const id of [head.challengerId, head.opponentId].sort()) {
        await lockUserRow(tx, id);
      }
      // Re-read under the lock; another instance may have settled it.
      const duel = await tx.duel.findUniqueOrThrow({ where: { id: duelId } });
      if (duel.status !== 'ACTIVE' || !duel.opponentId || !duel.startsAt || !duel.endsAt) {
        return;
      }

      const [cScore, oScore, cUser, oUser] = await Promise.all([
        this.scoreMilli(tx, duel.challengerId, duel.startsAt, duel.endsAt),
        this.scoreMilli(tx, duel.opponentId, duel.startsAt, duel.endsAt),
        tx.user.findUniqueOrThrow({
          where: { id: duel.challengerId },
          select: { pointsBalance: true },
        }),
        tx.user.findUniqueOrThrow({
          where: { id: duel.opponentId },
          select: { pointsBalance: true },
        }),
      ]);

      const result = settleDuel({
        challengerScoreMilli: cScore,
        opponentScoreMilli: oScore,
        challengerBalanceMilli: cUser.pointsBalance,
        opponentBalanceMilli: oUser.pointsBalance,
        stakeBp: duel.stakeBp,
      });

      const winnerId =
        result.winner === 'challenger'
          ? duel.challengerId
          : result.winner === 'opponent'
            ? duel.opponentId
            : null;
      const loserId =
        result.winner === 'challenger'
          ? duel.opponentId
          : result.winner === 'opponent'
            ? duel.challengerId
            : null;

      if (winnerId && loserId && result.transferMilli > 0n) {
        const meta = { duelId: duel.id, code: duel.code, stakeBp: duel.stakeBp };
        await tx.user.update({
          where: { id: loserId },
          data: { pointsBalance: { decrement: result.transferMilli } },
        });
        await tx.user.update({
          where: { id: winnerId },
          data: { pointsBalance: { increment: result.transferMilli } },
        });
        await tx.ledgerEntry.createMany({
          data: [
            {
              userId: loserId,
              reason: 'DUEL_LOSS',
              deltaMilli: -result.transferMilli,
              meta,
            },
            {
              userId: winnerId,
              reason: 'DUEL_WIN',
              deltaMilli: result.transferMilli,
              meta,
            },
          ],
        });
      }

      await tx.duel.update({
        where: { id: duel.id },
        data: {
          status: 'SETTLED',
          challengerScoreMilli: cScore,
          opponentScoreMilli: oScore,
          winnerId,
          transferMilli: result.transferMilli,
          settledAt: new Date(),
        },
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private async scoreMilli(
    client: Prisma.TransactionClient | PrismaService,
    userId: string,
    from: Date,
    to: Date,
  ): Promise<bigint> {
    const agg = await client.ledgerEntry.aggregate({
      where: { userId, reason: 'MINING', createdAt: { gte: from, lte: to } },
      _sum: { deltaMilli: true },
    });
    return agg._sum.deltaMilli ?? 0n;
  }

  private async side(userId: string): Promise<DuelSideDto> {
    const r = await publicRigReadout(this.rig, this.prisma, userId);
    return {
      id: r.id,
      name: r.name,
      ratePerHour: r.ratePerHour,
      gridStability: r.gridStability,
      countryCode: r.countryCode,
    };
  }

  private async toDto(duel: Duel, viewerId: string | null): Promise<DuelDto> {
    const now = new Date();
    const windowOpen = duel.startsAt && duel.endsAt;
    const to = windowOpen && duel.endsAt && duel.endsAt < now ? duel.endsAt : now;

    const [challenger, opponent, cLive, oLive] = await Promise.all([
      this.side(duel.challengerId),
      duel.opponentId ? this.side(duel.opponentId) : null,
      duel.status === 'SETTLED'
        ? (duel.challengerScoreMilli ?? 0n)
        : windowOpen && duel.startsAt
          ? this.scoreMilli(this.prisma, duel.challengerId, duel.startsAt, to)
          : 0n,
      duel.status === 'SETTLED'
        ? (duel.opponentScoreMilli ?? 0n)
        : windowOpen && duel.startsAt && duel.opponentId
          ? this.scoreMilli(this.prisma, duel.opponentId, duel.startsAt, to)
          : 0n,
    ]);

    return {
      id: duel.id,
      code: duel.code,
      status: duel.status,
      stakeBp: duel.stakeBp,
      stakePercent: (duel.stakeBp / BP_ONE) * 100,
      startsAt: duel.startsAt,
      endsAt: duel.endsAt,
      createdAt: duel.createdAt,
      challenger,
      opponent,
      winnerId: duel.winnerId,
      transferPoints: Number(duel.transferMilli ?? 0n) / MILLI,
      liveScore: {
        challenger: Number(cLive) / MILLI,
        opponent: Number(oLive) / MILLI,
      },
      mine:
        viewerId === null
          ? null
          : viewerId === duel.challengerId
            ? 'challenger'
            : viewerId === duel.opponentId
              ? 'opponent'
              : null,
    };
  }
}
