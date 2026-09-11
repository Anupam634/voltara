import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { lockUserRow } from '../common/row-lock';
import { maskIdentity } from '../common/mask-identity';
import { RigService } from '../rig/rig.service';
import { toEnginePart } from '../rig/rig-context.service';
import { rigTelemetry } from '../mining/rig.engine';
import {
  challengeFor,
  compareSubmissions,
  MAX_PARTS,
  rankSubmissions,
  REWARD_CODES,
} from './challenge.rules';

/** Catalogue entry the builder UI needs to place a part. */
export interface CatalogPartDto {
  code: string;
  name: string;
  kind: string;
  priceUsd: number;
  hashPerHour: number;
  heat: number;
  cooling: number;
  watts: number;
  wattsSupplied: number;
  hashBoostPercent: number;
  tier: number;
}

export interface ChallengeDto {
  id: string;
  weekKey: string;
  title: string;
  body: string;
  targetHashPerHour: number;
  startsAt: Date;
  endsAt: Date;
  submissions: number;
  rewards: readonly string[];
}

export interface SubmissionDto {
  id: string;
  rank: number;
  user: { id: string; name: string };
  partCodes: string[];
  costUsd: number;
  hashPerHour: number;
  gridStability: number;
  createdAt: Date;
  mine: boolean;
}

const submissionInclude = {
  user: { select: { id: true, email: true } },
} satisfies Prisma.ChallengeSubmissionInclude;

type SubmissionRow = Prisma.ChallengeSubmissionGetPayload<{ include: typeof submissionInclude }>;

/** A part only ever expires in the rig sim; the blueprint is hypothetical. */
const FAR_FUTURE = new Date('2999-01-01T00:00:00Z');

/** Duration of a challenge prize part. */
const REWARD_DAYS = 30;

/**
 * The weekly blueprint challenge.
 *
 * A miner submits a hypothetical build (up to six catalogue codes); the
 * server re-computes cost, hash and stability with the same engine the
 * real rig uses, so nothing can be forged. When the week closes the top
 * three by cost receive a part on their real rig.
 */
@Injectable()
export class ChallengesService implements OnModuleInit {
  private readonly log = new Logger(ChallengesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rig: RigService,
  ) {}

  async onModuleInit() {
    await this.rollWeek().catch((err) => this.log.warn(`challenge roll on boot failed: ${err}`));
  }

  /** Monday 00:05 UTC: close last week, open this one. */
  @Cron('5 0 * * 1')
  async weekly() {
    await this.rollWeek();
  }

  /** Ensure the current week exists, then pay out any closed week. */
  async rollWeek(now = new Date()) {
    await this.ensureCurrent(now);
    await this.grantPendingRewards(now);
  }

  /** The current week's row, created on first touch. */
  async ensureCurrent(now = new Date()) {
    const spec = challengeFor(now);
    const existing = await this.prisma.challenge.findUnique({ where: { weekKey: spec.weekKey } });
    if (existing) return existing;
    try {
      return await this.prisma.challenge.create({
        data: {
          weekKey: spec.weekKey,
          title: spec.title,
          body: spec.body,
          targetHashMilli: spec.targetPerHour * 1000,
          startsAt: spec.startsAt,
          endsAt: spec.endsAt,
        },
      });
    } catch (err) {
      // Two instances booting together both try to create the week; the
      // unique key lets one win and the other re-read.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.prisma.challenge.findUniqueOrThrow({ where: { weekKey: spec.weekKey } });
      }
      throw err;
    }
  }

  /** GET /challenge */
  async board(userId: string) {
    const now = new Date();
    const current = await this.ensureCurrent(now);

    const [plans, rows, previousRow] = await Promise.all([
      this.prisma.boosterPlan.findMany({
        where: { active: true, code: { not: null } },
        orderBy: [{ kind: 'asc' }, { priceUsd: 'asc' }],
      }),
      this.prisma.challengeSubmission.findMany({
        where: { challengeId: current.id },
        include: submissionInclude,
      }),
      this.prisma.challenge.findFirst({
        where: { endsAt: { lte: now } },
        orderBy: { endsAt: 'desc' },
        include: { submissions: { include: submissionInclude } },
      }),
    ]);

    const ranked = rankSubmissions(rows);
    const mineRow = ranked.find((r) => r.userId === userId) ?? null;

    return {
      challenge: challengeDto(current, rows.length),
      catalog: plans.map(catalogDto),
      mine: mineRow ? submissionDto(mineRow, mineRow.rank, userId) : null,
      top: ranked.slice(0, 10).map((r) => submissionDto(r, r.rank, userId)),
      previous: previousRow
        ? {
            challenge: challengeDto(previousRow, previousRow.submissions.length),
            winners: rankSubmissions(previousRow.submissions)
              .slice(0, REWARD_CODES.length)
              .map((r) => submissionDto(r, r.rank, userId)),
          }
        : null,
    };
  }

  /** POST /challenge/submit */
  async submit(userId: string, partCodes: string[]) {
    const now = new Date();
    const current = await this.ensureCurrent(now);
    if (current.endsAt.getTime() <= now.getTime()) {
      throw new BadRequestException('This week has closed. A new challenge opens shortly.');
    }
    if (partCodes.length > MAX_PARTS) {
      throw new BadRequestException(`A blueprint holds at most ${MAX_PARTS} parts.`);
    }

    const plans = await this.prisma.boosterPlan.findMany({
      where: { active: true, code: { in: partCodes } },
    });
    const byCode = new Map(plans.map((p) => [p.code as string, p]));
    const missing = partCodes.filter((c) => !byCode.has(c));
    if (missing.length) {
      throw new BadRequestException(`Unknown part code: ${missing.join(', ')}.`);
    }

    const chosen = partCodes.map((c) => byCode.get(c)!);
    const costUsd = chosen.reduce((s, p) => s + p.priceUsd, 0);
    // Stock chassis, no event, no overclock, no squad: the challenge is
    // about the build alone.
    const t = rigTelemetry({ parts: chosen.map((p) => toEnginePart(p, FAR_FUTURE)), now });

    if (t.gridStability !== 100) {
      throw new BadRequestException(
        `That build runs at ${t.gridStability}% stability — it needs 100%. ` +
          (t.overheating ? 'Add cooling. ' : '') +
          (t.brownout ? 'Add power. ' : ''),
      );
    }
    if (t.hashMilli < current.targetHashMilli) {
      throw new BadRequestException(
        `That build makes ${t.hashMilli / 1000} hash/h; the target is ${current.targetHashMilli / 1000}.`,
      );
    }

    const row = await this.prisma.challengeSubmission.upsert({
      where: { challengeId_userId: { challengeId: current.id, userId } },
      create: {
        challengeId: current.id,
        userId,
        partCodes,
        costUsd,
        hashMilli: t.hashMilli,
        gridStability: t.gridStability,
      },
      update: { partCodes, costUsd, hashMilli: t.hashMilli, gridStability: t.gridStability },
      include: submissionInclude,
    });

    // Rank = one more than the number of entries that beat this one.
    const others = await this.prisma.challengeSubmission.findMany({
      where: { challengeId: current.id, NOT: { id: row.id } },
      select: { costUsd: true, hashMilli: true, createdAt: true },
    });
    const rank = others.filter((o) => compareSubmissions(o, row) < 0).length + 1;

    return { mine: submissionDto(row, rank, userId), rank };
  }

  /**
   * Pay out every closed week that has not been paid. Each winner gets a
   * part on their real rig, granted under their row lock so it cannot
   * collide with a purchase's auto-install.
   */
  async grantPendingRewards(now = new Date()) {
    const closed = await this.prisma.challenge.findMany({
      where: { endsAt: { lte: now }, rewardsGrantedAt: null },
      include: { submissions: true },
    });

    for (const ch of closed) {
      const winners = rankSubmissions(ch.submissions).slice(0, REWARD_CODES.length);
      const plans = await this.prisma.boosterPlan.findMany({
        where: { code: { in: [...REWARD_CODES] } },
      });
      const planByCode = new Map(plans.map((p) => [p.code as string, p]));

      for (const w of winners) {
        const code = REWARD_CODES[w.rank - 1];
        const plan = planByCode.get(code);
        if (!plan) {
          this.log.warn(`challenge ${ch.weekKey}: reward plan ${code} missing, skipping rank ${w.rank}`);
          continue;
        }
        await this.prisma.$transaction(async (tx) => {
          await lockUserRow(tx, w.userId);
          const booster = await tx.booster.create({
            data: {
              userId: w.userId,
              planId: plan.id,
              source: 'CHALLENGE',
              expiresAt: new Date(now.getTime() + REWARD_DAYS * 86_400_000),
            },
          });
          await tx.ledgerEntry.create({
            data: {
              userId: w.userId,
              reason: 'CHALLENGE_REWARD',
              deltaMilli: 0n,
              meta: { challengeId: ch.id, weekKey: ch.weekKey, rank: w.rank, partCode: code },
            },
          });
          await this.rig.autoInstall(tx, w.userId, booster.id);
        });
      }

      await this.prisma.challenge.update({
        where: { id: ch.id },
        data: { rewardsGrantedAt: now },
      });
      this.log.log(`challenge ${ch.weekKey}: rewarded ${winners.length} winner(s)`);
    }
  }
}

function challengeDto(
  c: { id: string; weekKey: string; title: string; body: string; targetHashMilli: number; startsAt: Date; endsAt: Date },
  submissions: number,
): ChallengeDto {
  return {
    id: c.id,
    weekKey: c.weekKey,
    title: c.title,
    body: c.body,
    targetHashPerHour: c.targetHashMilli / 1000,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    submissions,
    rewards: REWARD_CODES,
  };
}

function submissionDto(row: SubmissionRow, rank: number, viewerId: string): SubmissionDto {
  return {
    id: row.id,
    rank,
    user: { id: row.user.id, name: maskIdentity(row.user) },
    partCodes: Array.isArray(row.partCodes) ? (row.partCodes as string[]) : [],
    costUsd: row.costUsd,
    hashPerHour: row.hashMilli / 1000,
    gridStability: row.gridStability,
    createdAt: row.createdAt,
    mine: row.userId === viewerId,
  };
}

function catalogDto(p: {
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
}): CatalogPartDto {
  return {
    code: p.code ?? '',
    name: p.name ?? `$${p.priceUsd} part`,
    kind: p.kind,
    priceUsd: p.priceUsd,
    hashPerHour: p.rateBonusMilli / 1000,
    heat: p.heat,
    cooling: p.cooling,
    watts: p.watts,
    wattsSupplied: p.wattsSupplied,
    hashBoostPercent: p.hashBoostBp / 100,
    tier: p.tier,
  };
}
