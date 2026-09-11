import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { lockUserRow } from '../common/row-lock';
import { maskIdentity } from '../common/mask-identity';
import { RigService } from '../rig/rig.service';
import { RigContextService } from '../rig/rig-context.service';
import { rigTelemetry } from '../mining/rig.engine';
import { effectiveRateMilli } from '../mining/mining.engine';
import {
  apprenticeEligibility,
  cutExpiresAt,
  mentorCutMilli,
  mentorEligibility,
  DEFAULT_MENTOR_CUT_BP,
  MAX_ACTIVE_APPRENTICES,
  MENTOR_CUT_DAYS,
  type MentorEligibility,
} from './apprentice.rules';

/**
 * Apprenticeship: a veteran adopting a newcomer.
 *
 * The relationship is deliberately not the referral graph. A referral is a
 * one-time credit for bringing someone through the door; this is ongoing,
 * can be formed with a stranger, and gives the mentor something to do with
 * the spare parts piling up in their inventory.
 *
 * All the rules live in `apprentice.rules.ts` so they can be tested without
 * a database. This file is the machinery: locks, transactions, and the
 * projections the UI reads.
 */
@Injectable()
export class ApprenticeService {
  private readonly logger = new Logger(ApprenticeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rig: RigService,
    private readonly context: RigContextService,
  ) {}

  /* ── Reads ────────────────────────────────────────────────────── */

  /** Whether this miner may take on an apprentice right now. */
  async eligibility(userId: string): Promise<MentorEligibility> {
    const [user, activeApprentices, own] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { createdAt: true },
      }),
      this.prisma.apprenticeship.count({
        where: { mentorId: userId, status: 'ACTIVE' },
      }),
      this.prisma.apprenticeship.findUnique({
        where: { apprenticeId: userId },
        select: { status: true },
      }),
    ]);

    // Stability is re-read live rather than cached: the requirement is that
    // the mentor's rig is holding *now*, not that it once did.
    const { telemetry } = await this.context.telemetryFor(userId);

    return mentorEligibility({
      createdAt: user.createdAt,
      gridStability: telemetry.gridStability,
      activeApprentices,
      hasMentor: own?.status === 'ACTIVE' || own?.status === 'PENDING',
    });
  }

  /** The whole apprenticeship screen for one miner. */
  async overview(userId: string) {
    const [mentorships, own, eligible] = await Promise.all([
      this.prisma.apprenticeship.findMany({
        where: { mentorId: userId, status: { in: ['PENDING', 'ACTIVE'] } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.apprenticeship.findUnique({
        where: { apprenticeId: userId },
      }),
      this.eligibility(userId),
    ]);

    const asMentor = await Promise.all(
      mentorships.map((a) => this.toDto(a, userId)),
    );

    // An offer this miner has been sent and has not answered. Kept separate
    // from `asApprentice` so the UI can show a decision, not a status.
    const invitesOpen =
      own && own.status === 'PENDING' ? [await this.toDto(own, userId)] : [];

    return {
      asMentor: asMentor.filter((a) => a.status === 'ACTIVE'),
      pendingOffers: asMentor.filter((a) => a.status === 'PENDING'),
      asApprentice:
        own && own.status === 'ACTIVE' ? await this.toDto(own, userId) : null,
      invitesOpen,
      eligible,
      cutDays: MENTOR_CUT_DAYS,
      maxApprentices: MAX_ACTIVE_APPRENTICES,
      /** Lifetime milli-points minted to this miner as a mentor. */
      mentorEarnedPoints: await this.mentorEarnings(userId),
    };
  }

  private async mentorEarnings(userId: string): Promise<number> {
    const sum = await this.prisma.ledgerEntry.aggregate({
      where: { userId, reason: 'MENTOR_CUT' },
      _sum: { deltaMilli: true },
    });
    return Number(sum._sum.deltaMilli ?? 0n) / 1000;
  }

  /* ── Writes ───────────────────────────────────────────────────── */

  /** Offer to mentor the miner behind `apprenticeCode`. */
  async offer(mentorId: string, apprenticeCode: string) {
    const code = apprenticeCode.trim();
    const apprentice = await this.prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true, createdAt: true, isBlocked: true },
    });
    if (!apprentice || apprentice.isBlocked) {
      throw new NotFoundException('No miner with that invite code.');
    }

    const eligible = await this.eligibility(mentorId);
    if (!eligible.canMentor) {
      throw new BadRequestException(mentorBlockMessage(eligible));
    }

    const existing = await this.prisma.apprenticeship.findUnique({
      where: { apprenticeId: apprentice.id },
      select: { status: true },
    });
    const check = apprenticeEligibility({
      createdAt: apprentice.createdAt,
      hasMentor: existing?.status === 'ACTIVE' || existing?.status === 'PENDING',
      isSelf: apprentice.id === mentorId,
    });
    if (!check.canBeAdopted) {
      throw new BadRequestException(apprenticeBlockMessage(check.reason));
    }
    // Ending is permanent for a pair, so a previously ENDED row must not be
    // revived into a new offer — otherwise "end" is only ever a pause.
    if (existing) {
      throw new BadRequestException(
        'That miner has already had a mentor. Apprenticeship is once per account.',
      );
    }

    const created = await this.prisma.apprenticeship.create({
      data: {
        mentorId,
        apprenticeId: apprentice.id,
        mentorCutBp: DEFAULT_MENTOR_CUT_BP,
      },
    });
    return this.toDto(created, mentorId);
  }

  /** The apprentice accepts. */
  async accept(userId: string, id: string) {
    const row = await this.mine(id, userId, 'apprentice');
    if (row.status !== 'PENDING') {
      throw new BadRequestException('That offer is no longer open.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, row.mentorId);
      // Capacity is re-checked under the lock: three apprentices accepting
      // at once must not take a mentor past the cap.
      const active = await tx.apprenticeship.count({
        where: { mentorId: row.mentorId, status: 'ACTIVE' },
      });
      if (active >= MAX_ACTIVE_APPRENTICES) {
        throw new BadRequestException(
          'That mentor has taken on as many apprentices as they can.',
        );
      }
      return tx.apprenticeship.update({
        where: { id: row.id },
        data: { status: 'ACTIVE', acceptedAt: new Date() },
      });
    });
    return this.toDto(updated, userId);
  }

  /** The apprentice declines. Permanent, like ending. */
  async decline(userId: string, id: string) {
    const row = await this.mine(id, userId, 'apprentice');
    if (row.status !== 'PENDING') {
      throw new BadRequestException('That offer is no longer open.');
    }
    const updated = await this.prisma.apprenticeship.update({
      where: { id: row.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    return this.toDto(updated, userId);
  }

  /** Either side ends it. Permanent for that pair. */
  async end(userId: string, id: string) {
    const row = await this.mine(id, userId, 'either');
    if (row.status === 'ENDED') {
      throw new BadRequestException('That apprenticeship has already ended.');
    }
    const updated = await this.prisma.apprenticeship.update({
      where: { id: row.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    return this.toDto(updated, userId);
  }

  /**
   * Hand a spare part to an apprentice.
   *
   * The part must be genuinely spare: owned, unexpired, not installed, not
   * listed for sale and not salvaged. Everything moves inside one
   * transaction under both row locks, ordered by id so two gifts in flight
   * cannot deadlock against each other.
   */
  async gift(mentorId: string, apprenticeshipId: string, boosterId: string) {
    const row = await this.mine(apprenticeshipId, mentorId, 'mentor');
    if (row.status !== 'ACTIVE') {
      throw new BadRequestException('That apprenticeship is not active.');
    }

    const [first, second] = [mentorId, row.apprenticeId].sort();

    return this.prisma.$transaction(async (tx) => {
      await lockUserRow(tx, first);
      await lockUserRow(tx, second);

      const part = await tx.booster.findUnique({
        where: { id: boosterId },
        include: { plan: true, slot: true, listing: true },
      });
      if (!part || part.userId !== mentorId) {
        throw new BadRequestException('That part is not in your inventory.');
      }
      if (part.slot) {
        throw new BadRequestException('Take the part out of your rig first.');
      }
      if (part.expiresAt <= new Date()) {
        throw new BadRequestException('That part has burned out.');
      }
      if (part.salvagedAt) {
        throw new BadRequestException('That part has already been salvaged.');
      }
      if (part.listing && part.listing.status === 'ACTIVE') {
        throw new BadRequestException('Cancel the market listing first.');
      }

      // There is no MENTOR source in the enum, and adding one would mean a
      // migration for a label. REFERRAL is the closest true statement: the
      // part was granted by another miner rather than bought.
      await tx.booster.update({
        where: { id: part.id },
        data: { userId: row.apprenticeId, source: 'REFERRAL' },
      });
      const slot = await this.rig.autoInstall(tx, row.apprenticeId, part.id);

      const meta = {
        apprenticeshipId: row.id,
        boosterId: part.id,
        partCode: part.plan.code,
        mentorId,
        apprenticeId: row.apprenticeId,
        slot,
      };
      // A row on both sides: the mentor's ledger should show what they gave
      // away, and the apprentice's should explain where the part came from.
      await tx.ledgerEntry.createMany({
        data: [
          { userId: mentorId, reason: 'REFERRAL_BONUS', deltaMilli: 0n, meta },
          { userId: row.apprenticeId, reason: 'REFERRAL_BONUS', deltaMilli: 0n, meta },
        ],
      });

      return {
        gifted: true,
        boosterId: part.id,
        partCode: part.plan.code,
        slot,
      };
    });
  }

  /**
   * Credit a mentor their share of an apprentice's claim.
   *
   * Called from inside the claim transaction. The cut is NEWLY MINTED: the
   * apprentice's own credit is never touched, so being mentored costs the
   * newcomer nothing. Returns the milli-points minted, or 0.
   *
   * Never throws — see the call site in `mining.service.ts`. A mentor's bonus
   * failing must not roll back the apprentice's own mining.
   */
  async creditMentor(
    tx: Prisma.TransactionClient,
    apprenticeId: string,
    earnedMilli: number,
    now = new Date(),
  ): Promise<number> {
    try {
      const link = await tx.apprenticeship.findUnique({
        where: { apprenticeId },
        select: { id: true, mentorId: true, status: true, acceptedAt: true, mentorCutBp: true },
      });
      if (!link || link.status !== 'ACTIVE') return 0;

      const cut = mentorCutMilli({
        earnedMilli,
        mentorCutBp: link.mentorCutBp,
        acceptedAt: link.acceptedAt,
        now,
      });
      if (cut <= 0) return 0;

      await tx.user.update({
        where: { id: link.mentorId },
        data: { pointsBalance: { increment: BigInt(cut) } },
      });
      await tx.ledgerEntry.create({
        data: {
          userId: link.mentorId,
          reason: 'MENTOR_CUT',
          deltaMilli: BigInt(cut),
          meta: {
            apprenticeshipId: link.id,
            apprenticeId,
            earnedMilli,
            cutBp: link.mentorCutBp,
            minted: true,
          },
        },
      });
      return cut;
    } catch (err) {
      this.logger.warn(
        `mentor cut skipped for apprentice ${apprenticeId}: ${(err as Error).message}`,
      );
      return 0;
    }
  }

  /* ── Helpers ──────────────────────────────────────────────────── */

  private async mine(
    id: string,
    userId: string,
    side: 'mentor' | 'apprentice' | 'either',
  ) {
    const row = await this.prisma.apprenticeship.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('No such apprenticeship.');
    const ok =
      side === 'mentor'
        ? row.mentorId === userId
        : side === 'apprentice'
          ? row.apprenticeId === userId
          : row.mentorId === userId || row.apprenticeId === userId;
    // Not-yours reads as not-found: whether an id exists is not a stranger's
    // business.
    if (!ok) throw new NotFoundException('No such apprenticeship.');
    return row;
  }

  /** One apprenticeship as the UI sees it, from `viewerId`'s side. */
  private async toDto(
    row: {
      id: string;
      mentorId: string;
      apprenticeId: string;
      status: string;
      mentorCutBp: number;
      createdAt: Date;
      acceptedAt: Date | null;
      endedAt: Date | null;
    },
    viewerId: string,
  ) {
    const otherId = row.mentorId === viewerId ? row.apprenticeId : row.mentorId;
    const other = await this.prisma.user.findUnique({
      where: { id: otherId },
      select: {
        id: true,
        email: true,
        countryCode: true,
        createdAt: true,
        referralCode: true,
        rateAdjustMilli: true,
        streakDays: true,
        rigCoolingBonus: true,
        rigPowerBonus: true,
        _count: { select: { referrals: true } },
      },
    });

    let ratePerHour = 0;
    let gridStability = 0;
    if (other) {
      const ctx = await this.context.load(other.id);
      const telemetry = rigTelemetry({
        parts: ctx.parts,
        chassis: {
          coolingBonus: other.rigCoolingBonus,
          powerBonus: other.rigPowerBonus,
        },
        modifiers: ctx.modifiers,
      });
      gridStability = telemetry.gridStability;
      ratePerHour =
        effectiveRateMilli({
          rig: telemetry,
          inviteCount: other._count.referrals,
          rateAdjustMilli: other.rateAdjustMilli,
          streakDays: other.streakDays,
        }) / 1000;
    }

    return {
      id: row.id,
      status: row.status,
      role: row.mentorId === viewerId ? ('mentor' as const) : ('apprentice' as const),
      cutPercent: row.mentorCutBp / 100,
      createdAt: row.createdAt,
      acceptedAt: row.acceptedAt,
      endedAt: row.endedAt,
      cutExpiresAt: row.acceptedAt ? cutExpiresAt(row.acceptedAt) : null,
      other: other
        ? {
            id: other.id,
            name: maskIdentity({ id: other.id, email: other.email }),
            countryCode: other.countryCode,
            joinedAt: other.createdAt,
            watchCode: other.referralCode,
            ratePerHour,
            gridStability,
          }
        : null,
    };
  }
}

function mentorBlockMessage(e: MentorEligibility): string {
  switch (e.reason) {
    case 'TOO_NEW':
      return `Mentoring opens after your first week — ${e.daysToWait} day(s) to go.`;
    case 'RIG_UNSTABLE':
      return 'Your own rig has to be holding 100% stability before you can teach someone else.';
    case 'AT_CAPACITY':
      return `You already have ${e.capacity} apprentices.`;
    case 'IS_APPRENTICE':
      return 'You cannot mentor while you are being mentored.';
    default:
      return 'You cannot take on an apprentice right now.';
  }
}

function apprenticeBlockMessage(reason: string | null): string {
  switch (reason) {
    case 'TOO_OLD':
      return 'That miner has been on the grid too long to be adopted.';
    case 'HAS_MENTOR':
      return 'That miner already has a mentor.';
    case 'IS_SELF':
      return 'You cannot mentor yourself.';
    default:
      return 'That miner cannot be adopted.';
  }
}
