import { AdminOpsService } from './ops.service';

/**
 * These views talk to Postgres, so what is pinned here is the reading each
 * one takes of what the database answered: which season counts as stalled,
 * how the grouped status rows map onto the tiles, and that a metric nobody
 * records comes back blank rather than plausible. The two raw-SQL metrics
 * (retention, median first purchase) need a real database and are not
 * covered.
 */

const WEEK = {
  startsAt: new Date('2026-09-07T00:00:00Z'),
  endsAt: new Date('2026-09-14T00:00:00Z'),
};

function buildService(overrides: {
  seasons?: unknown[];
  duels?: { status: string; _count: { _all: number } }[];
  listings?: { status: string; _count: { _all: number } }[];
  counts?: Record<string, number>;
}) {
  const counts = overrides.counts ?? {};
  const prisma = {
    season: { findMany: jest.fn(async () => overrides.seasons ?? []) },
    duel: { groupBy: jest.fn(async () => overrides.duels ?? []) },
    partListing: { groupBy: jest.fn(async () => overrides.listings ?? []) },
    squad: { count: jest.fn(async () => counts.squads ?? 0) },
    challenge: { findFirst: jest.fn(async () => null) },
    challengeSubmission: { count: jest.fn(async () => 0) },
    dailyPuzzle: { findFirst: jest.fn(async () => null) },
    dailySubmission: { count: jest.fn(async () => 0) },
    apprenticeship: { count: jest.fn(async () => 0) },
    rigSlot: { count: jest.fn(async () => 0) },
    userSkin: { count: jest.fn(async () => 0) },
    ledgerEntry: { aggregate: jest.fn(async () => ({ _sum: { deltaMilli: 0n } })) },
    user: {
      count: jest.fn(async (args?: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        if ('referredById' in where) return counts.referred ?? 0;
        if ('createdAt' in where) {
          const c = where.createdAt as Record<string, unknown>;
          return 'lt' in c ? (counts.base ?? 0) : (counts.signups ?? 0);
        }
        return counts.users ?? 0;
      }),
    },
    $queryRaw: jest.fn(async () => []),
  };

  const grid = {
    eventBoard: jest.fn(async () => ({ active: null, upcoming: null, recent: [] })),
    stats: jest.fn(async () => ({ miners: 0 })),
    map: jest.fn(async () => ({ countries: [] })),
  };
  const weather = { table: jest.fn(() => ({ countries: [], updatedAt: null })) };
  const collective = { board: jest.fn(async () => ({ holding: false })) };

  const service = new AdminOpsService(
    prisma as never,
    grid as never,
    weather as never,
    collective as never,
  );
  return { service, prisma, grid, weather, collective };
}

describe('seasons view', () => {
  it('tells a running week apart from one that ended without settling', async () => {
    // The distinction that matters: a closed week that paid nobody is a quiet
    // zero, and a week that never closed is a cron that did not fire. Both
    // show zero awards, so they must be separable on the row itself.
    const past = new Date(Date.now() - 30 * 86_400_000);
    const { service } = buildService({
      seasons: [
        { weekKey: '2026-W40', startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000), closedAt: null, awards: [] },
        { weekKey: '2026-W37', startsAt: past, endsAt: past, closedAt: null, awards: [] },
        { weekKey: '2026-W36', startsAt: past, endsAt: past, closedAt: past, awards: [] },
      ],
    });

    const { seasons } = await service.seasons();

    expect(seasons[0]).toMatchObject({ weekKey: '2026-W40', running: true, closedAt: null });
    expect(seasons[1]).toMatchObject({ weekKey: '2026-W37', running: false, closedAt: null });
    expect(seasons[2].running).toBe(false);
    expect(seasons[2].closedAt).not.toBeNull();
  });

  it('totals what a season actually paid, from the recorded awards', async () => {
    const past = new Date(Date.now() - 30 * 86_400_000);
    const { service } = buildService({
      seasons: [
        {
          weekKey: '2026-W36',
          startsAt: past,
          endsAt: past,
          closedAt: past,
          awards: [
            { rank: 1, userId: 'a', earnedMilli: 9_000n, prizeMilli: 200_000n, user: { id: 'a', email: 'alpha@example.com' } },
            { rank: 2, userId: 'b', earnedMilli: 5_000n, prizeMilli: 120_000n, user: { id: 'b', email: null } },
          ],
        },
      ],
    });

    const { seasons } = await service.seasons();

    expect(seasons[0].paidCount).toBe(2);
    expect(seasons[0].paidVolts).toBe(320);
    // Other people's accounts, so the email never leaves whole.
    expect(seasons[0].awards[0].displayName).toBe('al***@example.com');
    expect(seasons[0].awards[0].displayName).not.toContain('alpha@');
  });
});

describe('social view', () => {
  it('maps grouped statuses onto the tiles, defaulting a missing status to zero', async () => {
    const { service } = buildService({
      duels: [
        { status: 'ACTIVE', _count: { _all: 3 } },
        { status: 'EXPIRED', _count: { _all: 7 } },
      ],
      listings: [{ status: 'ACTIVE', _count: { _all: 2 } }],
      counts: { squads: 4 },
    });

    const out = await service.social();

    expect(out.duels).toEqual({ open: 0, active: 3, settled: 0, expired: 7, cancelled: 0 });
    expect(out.market.active).toBe(2);
    expect(out.market.sold).toBe(0);
    expect(out.squads.total).toBe(4);
  });

  it('reports the market fee as a positive figure', async () => {
    // Fees are debits in the ledger, so the raw sum is negative; an operator
    // reading "revenue" should not see a minus sign.
    const { service, prisma } = buildService({});
    prisma.ledgerEntry.aggregate.mockResolvedValue({ _sum: { deltaMilli: -4_500n } });

    const out = await service.social();

    expect(out.market.feesWeekVolts).toBe(4.5);
  });
});

describe('growth metrics', () => {
  it('never invents a share rate', async () => {
    // Nothing records a share. A plausible-looking number here would be
    // acted on, which is worse than an empty tile.
    const { service } = buildService({});

    const out = await service.growth();

    expect(out.shareRate.value).toBeNull();
    expect(out.shareRate.reason).toMatch(/not tracked/i);
  });

  it('computes K against the miners who existed when the window opened', async () => {
    const { service } = buildService({ counts: { referred: 30, signups: 100, base: 60 } });

    const out = await service.growth();

    expect(out.kFactor.value).toBe(0.5);
    expect(out.kFactor.referredSignups).toBe(30);
    expect(out.kFactor.baseUsers).toBe(60);
  });

  it('returns null rather than dividing by an empty userbase', async () => {
    const { service } = buildService({ counts: { referred: 0, signups: 5, base: 0 } });

    const out = await service.growth();

    expect(out.kFactor.value).toBeNull();
  });
});

describe('grid view', () => {
  it('reads the same services the rigs are scored against', async () => {
    // Recomputing these would let the admin panel and the miners' dashboards
    // disagree about how many rigs are running.
    const { service, grid, weather, collective } = buildService({});

    await service.gridOps();

    expect(grid.eventBoard).toHaveBeenCalled();
    expect(grid.stats).toHaveBeenCalled();
    expect(weather.table).toHaveBeenCalled();
    expect(collective.board).toHaveBeenCalled();
  });
});
