import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { TtlCache } from '../common/ttl-cache';
import { lockUserRow } from '../common/row-lock';
import { maskIdentity } from '../common/mask-identity';
import {
  EXCLUDED_REASONS,
  PRIZE_VOLTS,
  SEASON_POOL_VOLTS,
  SEASON_SIZE,
  SeasonWindow,
  prizeForRank,
  previousSeason,
  rankSeason,
  seasonFor,
} from './season.rules';

const MILLI = 1000;

/**
 * The live board is recomputed from the ledger, and the leaderboard page
 * asks for it on every visit. Short enough that a fresh claim shows up
 * while a miner is still watching, long enough that a traffic spike does
 * not turn into one aggregate per page view — the same bargain
 * LeaderboardService makes.
 */
const CACHE_TTL_MS = 30_000;

export interface SeasonStandingDto {
  rank: number;
  id: string;
  displayName: string;
  countryCode: string;
  /** VOLTS earned inside the season window. */
  earned: number;
  /** VOLTS this place is worth — projected while the season is still running. */
  prize: number;
  isCurrentUser: boolean;
  watchCode: string | null;
}

export interface SeasonDto {
  weekKey: string;
  startsAt: Date;
  endsAt: Date;
  closedAt: Date | null;
  poolVolts: number;
  prizes: readonly number[];
  places: number;
  standings: SeasonStandingDto[];
  me: {
    rank: number | null;
    earned: number;
    /** What the caller's place would pay; 0 outside the paid places. */
    prize: number;
    totalRanked: number;
  };
}

/**
 * The weekly leaderboard season.
 *
 * The leaderboard's own WEEK filter is a rolling seven days — good for
 * browsing, useless as a prize, because a rolling window never ends. A
 * season is one fixed Monday-to-Monday block that closes, pays, and stays
 * on the record. The window arithmetic and the prize table live in
 * `season.rules.ts`; this class is the database and the clock around them.
 *
 * Ranked earnings are the ledger's *credits* inside the window — the same
 * definition the leaderboard's EARNINGS board uses, minus the reasons that
 * would let last week's result feed this week's (see `EXCLUDED_REASONS`).
 */
@Injectable()
export class SeasonsService implements OnModuleInit {
  private readonly log = new Logger(SeasonsService.name);
  private readonly cache = new TtlCache(CACHE_TTL_MS, 5_000);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.roll().catch((err) => this.log.warn(`season roll on boot failed: ${err}`));
  }

  /**
   * Monday 00:10 UTC: close the week that just ended, open the new one.
   *
   * Five minutes behind the blueprint challenge's own roll, so the two
   * weekly jobs do not contend for the same user rows at the same instant.
   */
  @Cron('10 0 * * 1')
  async weekly() {
    await this.roll();
  }

  /**
   * Make sure both the running season and the one before it exist, then pay
   * out anything due.
   *
   * The previous week is ensured as well as the current one so a deploy gap
   * cannot silently swallow a season: if nothing was running last Monday,
   * the row is created now and closed by the same pass.
   */
  async roll(now = new Date()) {
    await this.ensureSeason(previousSeason(now));
    await this.ensureSeason(seasonFor(now));
    await this.closeDue(now);
  }

  /** The season row for a window, created on first touch. */
  private async ensureSeason(window: SeasonWindow) {
    const existing = await this.prisma.season.findUnique({ where: { weekKey: window.key } });
    if (existing) return existing;
    try {
      return await this.prisma.season.create({
        data: { weekKey: window.key, startsAt: window.startsAt, endsAt: window.endsAt },
      });
    } catch (err) {
      // Two instances booting together both try to open the week; the
      // unique key lets one win and the other re-read.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.prisma.season.findUniqueOrThrow({ where: { weekKey: window.key } });
      }
      throw err;
    }
  }

  /**
   * Credit every season whose week has ended and which has not paid yet.
   *
   * Each award is written in its own transaction under the winner's row
   * lock, so a prize cannot interleave with a claim or a withdrawal reading
   * the same balance. The unique `(seasonId, userId)` index is the real
   * idempotency guard: if this pass dies halfway and runs again — or two
   * instances wake together — the second attempt collides on the miners
   * already paid and skips them rather than paying twice.
   */
  async closeDue(now = new Date()) {
    const due = await this.prisma.season.findMany({
      where: { endsAt: { lte: now }, closedAt: null },
      orderBy: { startsAt: 'asc' },
    });

    for (const season of due) {
      const placings = rankSeason(
        await this.earnersIn({ startsAt: season.startsAt, endsAt: season.endsAt }, SEASON_SIZE),
      );

      let paid = 0;
      for (const placing of placings) {
        if (placing.prizeMilli <= 0n) continue;
        if (await this.award(season.id, season.weekKey, placing)) paid += 1;
      }

      await this.prisma.season.update({ where: { id: season.id }, data: { closedAt: now } });
      this.cache.invalidate();
      this.log.log(`season ${season.weekKey}: closed, paid ${paid} of ${placings.length} place(s)`);
    }
  }

  /** One winner's prize. False if they had already been paid. */
  private async award(
    seasonId: string,
    weekKey: string,
    placing: { userId: string; rank: number; earnedMilli: bigint; prizeMilli: bigint },
  ): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockUserRow(tx, placing.userId);
        // First, so the unique index rejects a repeat before any balance moves.
        await tx.seasonAward.create({
          data: {
            seasonId,
            userId: placing.userId,
            rank: placing.rank,
            earnedMilli: placing.earnedMilli,
            prizeMilli: placing.prizeMilli,
          },
        });
        await tx.user.update({
          where: { id: placing.userId },
          data: { pointsBalance: { increment: placing.prizeMilli } },
        });
        await tx.ledgerEntry.create({
          data: {
            userId: placing.userId,
            reason: 'SEASON_REWARD',
            deltaMilli: placing.prizeMilli,
            meta: { seasonId, weekKey, rank: placing.rank },
          },
        });
      });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.log.warn(`season ${weekKey}: rank ${placing.rank} already paid, skipping`);
        return false;
      }
      throw err;
    }
  }

  // ───────────────────────────── reads ─────────────────────────────

  /** GET /season */
  async board(userId: string): Promise<{ current: SeasonDto; previous: SeasonDto | null }> {
    const now = new Date();
    const window = seasonFor(now);
    const [current, previous] = await Promise.all([
      this.currentDto(window, userId, now),
      this.previousDto(window, userId),
    ]);
    return { current, previous };
  }

  /**
   * The running season, scored live from the ledger.
   *
   * Nothing here is committed: the standing is what the miner would win if
   * the week ended now, which is the whole point of showing it mid-week.
   */
  private async currentDto(window: SeasonWindow, userId: string, now: Date): Promise<SeasonDto> {
    const upTo = { startsAt: window.startsAt, endsAt: now };
    const [rows, standing] = await Promise.all([
      this.cache.wrap(`top:${window.key}`, () => this.earnersIn(upTo, SEASON_SIZE)),
      this.cache.wrap(`me:${window.key}:${userId}`, () => this.standingIn(upTo, userId)),
    ]);

    const placings = rankSeason(rows);
    const users = await this.hydrate(placings.map((p) => p.userId));

    return {
      weekKey: window.key,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      closedAt: null,
      poolVolts: SEASON_POOL_VOLTS,
      prizes: PRIZE_VOLTS,
      places: SEASON_SIZE,
      standings: placings.map((p) => standingDto(p, users.get(p.userId), userId)),
      me: {
        rank: standing.rank,
        earned: Number(standing.earnedMilli) / MILLI,
        prize: standing.rank === null ? 0 : prizeForRank(standing.rank),
        totalRanked: standing.totalRanked,
      },
    };
  }

  /**
   * The last season that actually paid.
   *
   * Read back from `SeasonAward` rather than recomputed: what a closed
   * season paid is a fact on the record, and re-deriving it would quietly
   * rewrite the past the first time the prize table or the excluded reasons
   * move.
   */
  private async previousDto(window: SeasonWindow, userId: string): Promise<SeasonDto | null> {
    const season = await this.prisma.season.findFirst({
      where: { closedAt: { not: null }, weekKey: { not: window.key } },
      orderBy: { startsAt: 'desc' },
      include: { awards: { orderBy: { rank: 'asc' } } },
    });
    if (!season) return null;

    const users = await this.hydrate(season.awards.map((a) => a.userId));
    const mine = season.awards.find((a) => a.userId === userId) ?? null;

    return {
      weekKey: season.weekKey,
      startsAt: season.startsAt,
      endsAt: season.endsAt,
      closedAt: season.closedAt,
      poolVolts: SEASON_POOL_VOLTS,
      prizes: PRIZE_VOLTS,
      places: SEASON_SIZE,
      standings: season.awards.map((a) => standingDto(a, users.get(a.userId), userId)),
      me: {
        rank: mine?.rank ?? null,
        earned: Number(mine?.earnedMilli ?? 0n) / MILLI,
        prize: Number(mine?.prizeMilli ?? 0n) / MILLI,
        totalRanked: season.awards.length,
      },
    };
  }

  /**
   * Top earners inside a window.
   *
   * Ordered by user id as well as by the total, so the database hands back
   * the same rows on a tie every time it runs. `rankSeason` breaks ties by
   * id, but a `take` applied to an unstable order would decide who is even
   * *considered* for tenth place at random.
   */
  private async earnersIn(window: { startsAt: Date; endsAt: Date }, take: number) {
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['userId'],
      where: {
        deltaMilli: { gt: 0 },
        createdAt: { gte: window.startsAt, lt: window.endsAt },
        reason: { notIn: [...EXCLUDED_REASONS] },
        user: { isBlocked: false },
      },
      _sum: { deltaMilli: true },
      orderBy: [{ _sum: { deltaMilli: 'desc' } }, { userId: 'asc' }],
      take,
    });
    return grouped.map((g) => ({ userId: g.userId, earnedMilli: g._sum.deltaMilli ?? 0n }));
  }

  /**
   * The caller's own place across the whole field, not just the page above
   * — a miner sitting 300th still gets a real number to chase.
   *
   * Ranking over an aggregate has no Prisma equivalent, so this counts in
   * SQL rather than pulling every group into memory. A miner who earned
   * nothing is unranked rather than last: a zero is not a standing.
   */
  private async standingIn(window: { startsAt: Date; endsAt: Date }, userId: string) {
    // `Prisma.join` expands to one placeholder per reason, so the exclusion
    // list stays a bound parameter list rather than an array literal the
    // driver has to cast.
    const excluded = Prisma.join(EXCLUDED_REASONS.map((r) => r as string));
    const [row] = await this.prisma.$queryRaw<
      { total_ranked: number; my_total: bigint; ahead: number }[]
    >(Prisma.sql`
      WITH totals AS (
        SELECT l."userId" AS id, SUM(l."deltaMilli")::bigint AS total
        FROM "LedgerEntry" l
        JOIN "User" u ON u."id" = l."userId"
        WHERE l."deltaMilli" > 0
          AND l."createdAt" >= ${window.startsAt}
          AND l."createdAt" < ${window.endsAt}
          AND l."reason"::text NOT IN (${excluded})
          AND u."isBlocked" = false
        GROUP BY l."userId"
      ), mine AS (
        SELECT COALESCE((SELECT total FROM totals WHERE id = ${userId}), 0) AS total
      )
      SELECT
        (SELECT COUNT(*) FROM totals)::int AS total_ranked,
        (SELECT total FROM mine)::bigint AS my_total,
        (SELECT COUNT(*) FROM totals WHERE total > (SELECT total FROM mine))::int AS ahead
    `);
    const earnedMilli = BigInt(row?.my_total ?? 0n);
    return {
      totalRanked: row?.total_ranked ?? 0,
      earnedMilli,
      rank: earnedMilli > 0n ? (row?.ahead ?? 0) + 1 : null,
    };
  }

  /** Display fields for a page of ranked ids, in one query. */
  private async hydrate(ids: string[]) {
    if (ids.length === 0) return new Map<string, HydratedUser>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      // referralCode is already public — it is the code in every share link
      // and the key the spectator rig card is fetched by.
      select: { id: true, email: true, countryCode: true, referralCode: true },
    });
    return new Map(users.map((u) => [u.id, u]));
  }
}

interface HydratedUser {
  id: string;
  email: string | null;
  countryCode: string | null;
  referralCode: string;
}

function standingDto(
  placing: { userId: string; rank: number; earnedMilli: bigint; prizeMilli: bigint },
  user: HydratedUser | undefined,
  viewerId: string,
): SeasonStandingDto {
  return {
    rank: placing.rank,
    id: placing.userId,
    displayName: maskIdentity({ id: placing.userId, email: user?.email ?? null }),
    countryCode: user?.countryCode ?? 'GLOBAL',
    earned: Number(placing.earnedMilli) / MILLI,
    prize: Number(placing.prizeMilli) / MILLI,
    isCurrentUser: placing.userId === viewerId,
    watchCode: user?.referralCode ?? null,
  };
}
