import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TtlCache } from '../common/ttl-cache';
import { GridService } from '../grid/grid.service';
import { WeatherService } from '../grid/weather.service';
import { CollectiveService } from '../grid/collective.service';
import { maskIdentity } from '../common/mask-identity';
import { SEASON_POOL_VOLTS, seasonFor } from '../seasons/season.rules';

const MILLI = 1000;
const DAY_MS = 86_400_000;

/**
 * Operator views for everything the rebrand added.
 *
 * The admin panel was built around the old flat-rate product: miners,
 * boosters, withdrawals, tasks. Since then the grid grew events, weather, a
 * collective goal, squads, duels, a part market, a weekly blueprint
 * challenge, a daily puzzle, apprenticeships and paid seasons — and an
 * operator could see none of it. A prize job that quietly stopped paying, a
 * grid event stuck on, or a market with no liquidity were all invisible.
 *
 * Kept out of `admin.service.ts` deliberately: that file is already 1,800
 * lines of the original product, and these are reads of a different surface.
 *
 * Everything here is read-only and cached. Nothing on this service mutates,
 * so an operator cannot break a running season by opening a tab.
 */
@Injectable()
export class AdminOpsService {
  /**
   * These are heavy aggregates behind a panel that several operators may
   * poll at once. Slightly longer than the miner-facing caches: nobody is
   * watching an admin chart tick.
   */
  private readonly cache = new TtlCache(30_000, 200);

  constructor(
    private readonly prisma: PrismaService,
    private readonly grid: GridService,
    private readonly weather: WeatherService,
    private readonly collective: CollectiveService,
  ) {}

  // ───────────────────────── grid operations ─────────────────────────

  /**
   * Is the grid healthy right now?
   *
   * Reuses `GridService` for the event board and the rig totals rather than
   * recomputing them, so the admin panel and the landing strip can never
   * disagree about how many rigs are running.
   */
  gridOps() {
    return this.cache.wrap('grid', async () => {
      const now = new Date();
      const [board, stats, map, collective, overclocking, slotsUsed, skinsOwned] =
        await Promise.all([
          this.grid.eventBoard(now),
          this.grid.stats(),
          this.grid.map(),
          this.collective.board(),
          this.prisma.user.count({ where: { overclockUntil: { gt: now } } }),
          this.prisma.rigSlot.count(),
          this.prisma.userSkin.count(),
        ]);

      return {
        event: board,
        stats,
        collective,
        // A reading per country, straight from the in-memory table the rigs
        // are actually being scored against — not a fresh API call.
        weather: this.weather.table(),
        rigs: {
          slotsUsed,
          overclocking,
          skinsOwned,
          countries: map.countries.length,
        },
        generatedAt: now.toISOString(),
      };
    });
  }

  // ─────────────────────────── seasons ───────────────────────────

  /**
   * Season history and what each one paid.
   *
   * The closed rows are the record of money leaving the system, so they are
   * read back from `SeasonAward` rather than recomputed — the same rule the
   * miner-facing endpoint follows.
   */
  seasons() {
    return this.cache.wrap('seasons', async () => {
      const now = new Date();
      const current = seasonFor(now);

      const rows = await this.prisma.season.findMany({
        orderBy: { startsAt: 'desc' },
        take: 12,
        include: {
          awards: {
            orderBy: { rank: 'asc' },
            include: { user: { select: { id: true, email: true } } },
          },
        },
      });

      return {
        poolVolts: SEASON_POOL_VOLTS,
        currentWeekKey: current.key,
        currentEndsAt: current.endsAt.toISOString(),
        seasons: rows.map((s) => ({
          weekKey: s.weekKey,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          closedAt: s.closedAt?.toISOString() ?? null,
          /** True while the week is still running — not a missed payout. */
          running: s.endsAt.getTime() > now.getTime(),
          /**
           * A closed week with no awards paid nobody. That is legitimate
           * when nobody mined, and a bug otherwise, so it is surfaced
           * rather than hidden behind a zero.
           */
          paidCount: s.awards.length,
          paidVolts: s.awards.reduce((sum, a) => sum + Number(a.prizeMilli), 0) / MILLI,
          awards: s.awards.map((a) => ({
            rank: a.rank,
            userId: a.userId,
            displayName: maskIdentity(a.user),
            earned: Number(a.earnedMilli) / MILLI,
            prize: Number(a.prizeMilli) / MILLI,
          })),
        })),
      };
    });
  }

  // ──────────────────── competitive and social ────────────────────

  /** Duels, squads, the part market, the challenge, the puzzle, mentors. */
  social() {
    return this.cache.wrap('social', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

      const [
        duelsByStatus,
        squads,
        squadMembers,
        listingsByStatus,
        marketFees,
        challenge,
        submissions,
        puzzle,
        puzzleSolves,
        mentorships,
        mentorCut,
      ] = await Promise.all([
        this.prisma.duel.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.squad.count(),
        this.prisma.user.count({ where: { squadId: { not: null } } }),
        this.prisma.partListing.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.ledgerEntry.aggregate({
          where: { reason: 'MARKET_FEE', createdAt: { gte: weekAgo } },
          _sum: { deltaMilli: true },
        }),
        this.prisma.challenge.findFirst({ orderBy: { startsAt: 'desc' } }),
        this.prisma.challengeSubmission.count({ where: { createdAt: { gte: weekAgo } } }),
        this.prisma.dailyPuzzle.findFirst({ orderBy: { createdAt: 'desc' } }),
        this.prisma.dailySubmission.count({ where: { createdAt: { gte: weekAgo } } }),
        this.prisma.apprenticeship.count(),
        this.prisma.ledgerEntry.aggregate({
          where: { reason: 'MENTOR_CUT', createdAt: { gte: weekAgo } },
          _sum: { deltaMilli: true },
        }),
      ]);

      const count = (rows: { status: string; _count: { _all: number } }[], status: string) =>
        rows.find((r) => r.status === status)?._count._all ?? 0;

      return {
        duels: {
          open: count(duelsByStatus, 'OPEN'),
          active: count(duelsByStatus, 'ACTIVE'),
          settled: count(duelsByStatus, 'SETTLED'),
          expired: count(duelsByStatus, 'EXPIRED'),
          cancelled: count(duelsByStatus, 'CANCELLED'),
        },
        squads: { total: squads, members: squadMembers },
        market: {
          active: count(listingsByStatus, 'ACTIVE'),
          sold: count(listingsByStatus, 'SOLD'),
          cancelled: count(listingsByStatus, 'CANCELLED'),
          /** Platform cut taken in the last 7 days, VOLTS. Fees are debits. */
          feesWeekVolts: Math.abs(Number(marketFees._sum.deltaMilli ?? 0n)) / MILLI,
        },
        challenge: {
          weekKey: challenge?.weekKey ?? null,
          title: challenge?.title ?? null,
          endsAt: challenge?.endsAt?.toISOString() ?? null,
          rewardsGrantedAt: challenge?.rewardsGrantedAt?.toISOString() ?? null,
          submissionsWeek: submissions,
        },
        daily: {
          dayKey: puzzle?.dayKey ?? null,
          solvesWeek: puzzleSolves,
        },
        apprenticeships: {
          total: mentorships,
          cutPaidWeekVolts: Number(mentorCut._sum.deltaMilli ?? 0n) / MILLI,
        },
        generatedAt: now.toISOString(),
      };
    });
  }

  // ───────────────────────── growth metrics ─────────────────────────

  /**
   * The four figures GROWTH.md §7 asks for.
   *
   * Three are measurable from what the database already records. The fourth,
   * share rate, is **not**: nothing tracks a share. Rather than substitute a
   * lookalike (rig-card page views, referral link hits) and let it be read
   * as the real thing, it comes back null with the reason attached. An
   * invented number here would be worse than a blank, because it would be
   * acted on.
   */
  growth() {
    return this.cache.wrap('growth', async () => {
      const [k, retention, purchase] = await Promise.all([
        this.kFactor(),
        this.retention(),
        this.firstPurchase(),
      ]);

      return {
        kFactor: k,
        retention,
        firstPurchase: purchase,
        shareRate: {
          value: null,
          /** Surfaced so the panel can say why the tile is empty. */
          reason:
            'Not tracked. No share event is recorded anywhere, so this cannot ' +
            'be measured without adding one — see GROWTH.md §7.',
          target: 15,
        },
      };
    });
  }

  /**
   * New miners produced per existing miner over 30 days.
   *
   * The textbook K = invites sent × conversion rate, and invites *sent* are
   * not recorded — only the signups that carried a referral code. So this is
   * the observable half: referred signups in the window divided by the
   * userbase that existed when the window opened. It answers "is the
   * userbase reproducing itself", which is what the target of 0.5 is for,
   * and it is labelled as the proxy it is.
   */
  private async kFactor() {
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [referred, total, base] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gte: since }, referredById: { not: null } },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { createdAt: { lt: since } } }),
    ]);

    return {
      /** Null rather than 0 when there is nobody to have invited anyone. */
      value: base > 0 ? round(referred / base, 3) : null,
      referredSignups: referred,
      totalSignups: total,
      /** Miners who already existed when the window opened. */
      baseUsers: base,
      target: 0.5,
      windowDays: 30,
    };
  }

  /**
   * D1 and D7, measured on cohorts old enough to have had the chance.
   *
   * A miner counts as retained on D1 if they mined at all in the 24 hours
   * after their first day, and on D7 if they mined at any point in the week
   * after it. Mining specifically, not "logged in": a tap is the action the
   * product exists for, and it is the one the ledger records honestly.
   *
   * The cohort window ends 8 days ago so that everyone in it has had a full
   * seven days — including yesterday's signups would drag D7 to zero for a
   * reason that has nothing to do with retention.
   */
  private async retention() {
    const now = Date.now();
    const cohortTo = new Date(now - 8 * DAY_MS);
    const cohortFrom = new Date(now - 38 * DAY_MS);

    const [row] = await this.prisma.$queryRaw<
      { size: bigint; d1: bigint; d7: bigint }[]
    >`
      WITH cohort AS (
        SELECT "id", "createdAt"
        FROM "User"
        WHERE "createdAt" >= ${cohortFrom} AND "createdAt" < ${cohortTo}
      )
      SELECT
        COUNT(*)::bigint AS size,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM "LedgerEntry" l
            WHERE l."userId" = c."id"
              AND l."reason" = 'MINING'
              AND l."createdAt" >= c."createdAt" + interval '1 day'
              AND l."createdAt" <  c."createdAt" + interval '2 day'
          )
        )::bigint AS d1,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM "LedgerEntry" l
            WHERE l."userId" = c."id"
              AND l."reason" = 'MINING'
              AND l."createdAt" >= c."createdAt" + interval '1 day'
              AND l."createdAt" <  c."createdAt" + interval '8 day'
          )
        )::bigint AS d7
      FROM cohort c
    `;

    const size = Number(row?.size ?? 0n);
    return {
      cohortSize: size,
      d1: size > 0 ? round((Number(row?.d1 ?? 0n) / size) * 100, 1) : null,
      d7: size > 0 ? round((Number(row?.d7 ?? 0n) / size) * 100, 1) : null,
      targetD1: 40,
      targetD7: 20,
      cohortFrom: cohortFrom.toISOString(),
      cohortTo: cohortTo.toISOString(),
    };
  }

  /**
   * How long it takes a signup to become a paying miner.
   *
   * Median rather than mean: one miner who buys after ninety days should not
   * move the number that describes everybody else. Only confirmed purchases
   * count — an abandoned payment intent is not a purchase.
   */
  private async firstPurchase() {
    const [row] = await this.prisma.$queryRaw<
      { payers: bigint; median_days: number | null }[]
    >`
      WITH firsts AS (
        SELECT p."userId" AS id, MIN(p."createdAt") AS bought
        FROM "BoosterPurchase" p
        WHERE p."status" = 'CONFIRMED'
        GROUP BY p."userId"
      )
      SELECT
        COUNT(*)::bigint AS payers,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (f.bought - u."createdAt")) / 86400
        ) AS median_days
      FROM firsts f
      JOIN "User" u ON u."id" = f.id
    `;

    const totalUsers = await this.prisma.user.count();
    const payers = Number(row?.payers ?? 0n);

    return {
      payers,
      totalUsers,
      conversionPercent: totalUsers > 0 ? round((payers / totalUsers) * 100, 2) : null,
      medianDays: row?.median_days == null ? null : round(row.median_days, 1),
      targetDays: 7,
    };
  }
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
