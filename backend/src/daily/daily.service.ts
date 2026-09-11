import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { maskIdentity } from '../common/mask-identity';
import { toEnginePart } from '../rig/rig-context.service';
import { rigTelemetry } from '../mining/rig.engine';
import {
  beatPercent,
  compareSubmissions,
  costDistribution,
  DAY_MS,
  MAX_PARTS,
  puzzleFor,
  rankSubmissions,
  shareBlock,
} from './daily.rules';

/** Catalogue entry the builder UI needs to place a part. */
export interface DailyCatalogPartDto {
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

export interface DailyPuzzleDto {
  dayKey: string;
  number: number;
  budgetUsd: number;
  targetHashPerHour: number;
  startsAt: Date;
  endsAt: Date;
}

export interface DailySubmissionDto {
  id: string;
  rank: number;
  user: { id: string; name: string };
  partCodes: string[];
  costUsd: number;
  hashPerHour: number;
  gridStability: number;
  attempts: number;
  solvedAt: Date;
  shareText: string;
  mine: boolean;
}

const submissionInclude = {
  user: { select: { id: true, email: true } },
} satisfies Prisma.DailySubmissionInclude;

type SubmissionRow = Prisma.DailySubmissionGetPayload<{ include: typeof submissionInclude }>;

/** A puzzle build is hypothetical; nothing in it ever expires. */
const FAR_FUTURE = new Date('2999-01-01T00:00:00Z');

/**
 * The daily rig puzzle.
 *
 * Every UTC day the grid poses one constraint — a budget and a hash target —
 * and every miner sees the same one. Submit a build; the server re-scores it
 * with the same engine the real rig uses, so nothing can be forged, and hands
 * back a two-line block built for pasting into a chat.
 *
 * Deliberately worthless in economic terms: no points, no parts, no effect on
 * anyone's mining rate. That keeps it entirely outside the withdrawal economy,
 * so it can be generous with bragging rights without ever being farmed.
 */
@Injectable()
export class DailyService implements OnModuleInit {
  private readonly log = new Logger(DailyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureToday().catch((err) =>
      this.log.warn(`daily puzzle roll on boot failed: ${err}`),
    );
  }

  /** One minute past midnight UTC: open the new day. */
  @Cron('1 0 * * *')
  async roll() {
    await this.ensureToday();
  }

  /**
   * Today's row, created on first touch.
   *
   * The spec is derived from the day key, so two instances racing here write
   * identical values and the unique index picks a winner.
   */
  async ensureToday(now = new Date()) {
    const spec = puzzleFor(now);
    const existing = await this.prisma.dailyPuzzle.findUnique({
      where: { dayKey: spec.dayKey },
    });
    if (existing) return existing;
    try {
      return await this.prisma.dailyPuzzle.create({
        data: {
          dayKey: spec.dayKey,
          budgetUsd: spec.budgetUsd,
          targetHashMilli: spec.targetHashMilli,
          seed: spec.seed,
          startsAt: spec.startsAt,
          endsAt: spec.endsAt,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.prisma.dailyPuzzle.findUniqueOrThrow({ where: { dayKey: spec.dayKey } });
      }
      throw err;
    }
  }

  /** GET /daily */
  async board(userId: string) {
    const now = new Date();
    const today = await this.ensureToday(now);
    const spec = puzzleFor(now);

    const [plans, rows, yesterdayRow] = await Promise.all([
      this.prisma.boosterPlan.findMany({
        where: { active: true, code: { not: null } },
        orderBy: [{ kind: 'asc' }, { priceUsd: 'asc' }],
      }),
      this.prisma.dailySubmission.findMany({
        where: { puzzleId: today.id },
        include: submissionInclude,
      }),
      this.prisma.dailyPuzzle.findUnique({
        where: { dayKey: dayKeyOf(new Date(spec.startsAt.getTime() - DAY_MS)) },
        include: { submissions: { include: submissionInclude } },
      }),
    ]);

    const byCode = new Map(plans.map((p) => [p.code as string, p]));
    const ranked = rankSubmissions(rows);
    const mineRow = ranked.find((r) => r.userId === userId) ?? null;

    return {
      puzzle: puzzleDto(today, spec.number),
      catalog: plans.map(catalogDto),
      mine: mineRow
        ? submissionDto(mineRow, mineRow.rank, userId, spec.number, byCode)
        : null,
      solvedCount: rows.length,
      distribution: costDistribution(rows),
      yesterday: yesterdayRow
        ? {
            dayKey: yesterdayRow.dayKey,
            number: spec.number - 1,
            best: rankSubmissions(yesterdayRow.submissions)
              .slice(0, 5)
              .map((r) => submissionDto(r, r.rank, userId, spec.number - 1, byCode)),
          }
        : null,
      top: ranked.slice(0, 10).map((r) => submissionDto(r, r.rank, userId, spec.number, byCode)),
    };
  }

  /** POST /daily/submit */
  async submit(userId: string, partCodes: string[]) {
    const now = new Date();
    const today = await this.ensureToday(now);
    const spec = puzzleFor(now);

    if (today.endsAt.getTime() <= now.getTime()) {
      throw new BadRequestException('Today’s puzzle has closed. A new one is already open.');
    }
    if (partCodes.length > MAX_PARTS) {
      throw new BadRequestException(`A rig has ${MAX_PARTS} sockets.`);
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

    // Stock chassis, no grid event, no overclock, no squad. The puzzle is
    // about the build alone, so everyone is scored on identical physics.
    const t = rigTelemetry({ parts: chosen.map((p) => toEnginePart(p, FAR_FUTURE)), now });

    // Each rule names itself, so a rejected build tells the miner what to fix.
    if (costUsd > today.budgetUsd) {
      throw new BadRequestException(
        `That build costs $${costUsd}; today’s budget is $${today.budgetUsd}.`,
      );
    }
    if (t.gridStability !== 100) {
      throw new BadRequestException(
        `That build runs at ${t.gridStability}% stability — it needs 100%. ` +
          (t.overheating ? 'Add cooling. ' : '') +
          (t.brownout ? 'Add power. ' : ''),
      );
    }
    if (t.hashMilli < today.targetHashMilli) {
      throw new BadRequestException(
        `That build makes ${t.hashMilli / 1000} hash/h; today’s target is ${
          today.targetHashMilli / 1000
        }.`,
      );
    }

    const row = await this.prisma.dailySubmission.upsert({
      where: { puzzleId_userId: { puzzleId: today.id, userId } },
      create: {
        puzzleId: today.id,
        userId,
        partCodes,
        costUsd,
        hashMilli: t.hashMilli,
        gridStability: t.gridStability,
        attempts: 1,
        solvedAt: now,
      },
      // `solvedAt` is deliberately not touched: it records when they first
      // cracked it, and a later cheaper build should not push it forward.
      update: {
        partCodes,
        costUsd,
        hashMilli: t.hashMilli,
        gridStability: t.gridStability,
        attempts: { increment: 1 },
      },
      include: submissionInclude,
    });

    const others = await this.prisma.dailySubmission.findMany({
      where: { puzzleId: today.id, NOT: { id: row.id } },
      select: { costUsd: true, hashMilli: true, createdAt: true },
    });
    const rank = others.filter((o) => compareSubmissions(o, row) < 0).length + 1;
    const dto = submissionDto(row, rank, userId, spec.number, byCode);

    return {
      mine: dto,
      rank,
      beatPercent: beatPercent(row, others),
      shareText: dto.shareText,
    };
  }
}

/** "2026-09-12" for an arbitrary instant, without re-deriving the spec. */
function dayKeyOf(d: Date): string {
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

function puzzleDto(
  p: { dayKey: string; budgetUsd: number; targetHashMilli: number; startsAt: Date; endsAt: Date },
  number: number,
): DailyPuzzleDto {
  return {
    dayKey: p.dayKey,
    number,
    budgetUsd: p.budgetUsd,
    targetHashPerHour: p.targetHashMilli / 1000,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
  };
}

function submissionDto(
  row: SubmissionRow,
  rank: number,
  viewerId: string,
  puzzleNumber: number,
  byCode: Map<string, { kind: string }>,
): DailySubmissionDto {
  const partCodes = Array.isArray(row.partCodes) ? (row.partCodes as string[]) : [];
  return {
    id: row.id,
    rank,
    user: { id: row.user.id, name: maskIdentity(row.user) },
    partCodes,
    costUsd: row.costUsd,
    hashPerHour: row.hashMilli / 1000,
    gridStability: row.gridStability,
    attempts: row.attempts,
    solvedAt: row.solvedAt,
    shareText: shareBlock({
      number: puzzleNumber,
      costUsd: row.costUsd,
      gridStability: row.gridStability,
      kinds: partCodes.map((c) => byCode.get(c)?.kind ?? ''),
    }),
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
}): DailyCatalogPartDto {
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
