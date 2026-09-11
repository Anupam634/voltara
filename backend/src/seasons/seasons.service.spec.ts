import { Prisma } from '@prisma/client';
import { SeasonsService } from './seasons.service';
import { SEASON_POOL_VOLTS, prizeMilliForRank } from './season.rules';

/**
 * The close job talks to Postgres, so what is pinned here is the decision it
 * makes given what the database answered: who gets paid, how much, that a
 * season is only settled once, and that a retry after a half-finished pass
 * does not pay the same miner twice. The SQL itself needs a real database
 * and is not covered.
 */

interface Tx {
  $queryRaw: jest.Mock;
  seasonAward: { create: jest.Mock };
  user: { update: jest.Mock };
  ledgerEntry: { create: jest.Mock };
}

/** The unique-constraint error Postgres raises on a second award. */
function duplicate() {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

interface Earner {
  userId: string;
  sum: bigint;
}

/** Just enough of each Prisma call's argument shape for the assertions below. */
interface FindManyArgs {
  where: { endsAt: unknown; closedAt: unknown };
}
interface GroupByArgs {
  where: {
    deltaMilli: unknown;
    createdAt: unknown;
    reason: { notIn: string[] };
    user: unknown;
  };
}
interface SeasonCreateArgs {
  data: { weekKey: string; startsAt: Date; endsAt: Date };
}

function buildService(params: {
  due?: { id: string; weekKey: string; startsAt: Date; endsAt: Date }[];
  earners?: Earner[];
  /** User ids whose award row already exists — a half-finished earlier pass. */
  alreadyPaid?: string[];
}) {
  const alreadyPaid = new Set(params.alreadyPaid ?? []);
  const tx: Tx = {
    $queryRaw: jest.fn(async () => []),
    seasonAward: {
      create: jest.fn(async ({ data }: { data: { userId: string } }) => {
        if (alreadyPaid.has(data.userId)) throw duplicate();
        return data;
      }),
    },
    user: { update: jest.fn(async () => ({})) },
    ledgerEntry: { create: jest.fn(async () => ({})) },
  };

  const prisma = {
    season: {
      findMany: jest.fn(async (_args: FindManyArgs) => params.due ?? []),
      findUnique: jest.fn(async () => null),
      findUniqueOrThrow: jest.fn(async () => ({})),
      create: jest.fn(async (args: SeasonCreateArgs) => args.data),
      update: jest.fn(async () => ({})),
    },
    ledgerEntry: {
      groupBy: jest.fn(async (_args: GroupByArgs) =>
        (params.earners ?? []).map((e) => ({ userId: e.userId, _sum: { deltaMilli: e.sum } })),
      ),
    },
    $transaction: jest.fn(async (fn: (t: Tx) => Promise<unknown>) => fn(tx)),
  };

  const service = new SeasonsService(prisma as never);
  return { service, prisma, tx };
}

const WEEK = {
  id: 's1',
  weekKey: '2026-W37',
  startsAt: new Date('2026-09-07T00:00:00Z'),
  endsAt: new Date('2026-09-14T00:00:00Z'),
};

describe('SeasonsService.closeDue', () => {
  it('pays the ranked places and marks the season settled', async () => {
    const { service, prisma, tx } = buildService({
      due: [WEEK],
      earners: [
        { userId: 'a', sum: 9_000n },
        { userId: 'b', sum: 5_000n },
      ],
    });

    await service.closeDue(new Date('2026-09-14T00:10:00Z'));

    expect(tx.seasonAward.create).toHaveBeenCalledTimes(2);
    expect(tx.seasonAward.create.mock.calls[0][0].data).toMatchObject({
      seasonId: 's1',
      userId: 'a',
      rank: 1,
      prizeMilli: prizeMilliForRank(1),
    });
    // The prize lands on the balance and in the ledger, so it shows up as
    // earnings everywhere else the ledger is the source of truth.
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { pointsBalance: { increment: prizeMilliForRank(1) } },
    });
    expect(tx.ledgerEntry.create.mock.calls[0][0].data).toMatchObject({
      userId: 'a',
      reason: 'SEASON_REWARD',
      deltaMilli: prizeMilliForRank(1),
    });
    expect(prisma.season.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { closedAt: new Date('2026-09-14T00:10:00Z') },
    });
  });

  it('takes the user row lock before touching the balance', async () => {
    // Without the lock a prize can interleave with a claim or a withdrawal
    // reading the same balance, and one of the two writes is lost.
    const { service, tx } = buildService({
      due: [WEEK],
      earners: [{ userId: 'a', sum: 9_000n }],
    });

    await service.closeDue(new Date('2026-09-14T00:10:00Z'));

    expect(tx.$queryRaw).toHaveBeenCalled();
    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(tx.user.update.mock.invocationCallOrder[0]);
    expect(lockOrder).toBeLessThan(tx.seasonAward.create.mock.invocationCallOrder[0]);
  });

  it('skips a miner an earlier pass already paid, and still settles the season', async () => {
    // The pass died after awarding 'a'. On the retry the unique index
    // rejects that row; 'b' must still be paid and the season must close.
    const { service, prisma, tx } = buildService({
      due: [WEEK],
      earners: [
        { userId: 'a', sum: 9_000n },
        { userId: 'b', sum: 5_000n },
      ],
      alreadyPaid: ['a'],
    });

    await service.closeDue(new Date('2026-09-14T00:10:00Z'));

    const credited = tx.user.update.mock.calls.map((c) => c[0].where.id);
    expect(credited).toEqual(['b']);
    expect(prisma.season.update).toHaveBeenCalled();
  });

  it('closes a season nobody mined without paying anything', async () => {
    const { service, prisma, tx } = buildService({ due: [WEEK], earners: [] });

    await service.closeDue(new Date('2026-09-14T00:10:00Z'));

    expect(tx.seasonAward.create).not.toHaveBeenCalled();
    expect(prisma.season.update).toHaveBeenCalled();
  });

  it('never pays a season that has already been settled', async () => {
    // `closedAt: null` is the filter that makes a second run a no-op.
    const { service, prisma, tx } = buildService({ due: [] });

    await service.closeDue(new Date('2026-09-14T00:10:00Z'));

    expect(prisma.season.findMany.mock.calls[0][0].where).toMatchObject({ closedAt: null });
    expect(tx.seasonAward.create).not.toHaveBeenCalled();
  });

  it('never pays out more than the advertised pool in one season', async () => {
    const earners = Array.from({ length: 25 }, (_, i) => ({
      userId: `u${String(i).padStart(2, '0')}`,
      sum: BigInt(1000 * (25 - i)),
    }));
    const { service, tx } = buildService({ due: [WEEK], earners });

    await service.closeDue(new Date('2026-09-14T00:10:00Z'));

    const paid = tx.user.update.mock.calls.reduce(
      (sum, c) => sum + (c[0].data.pointsBalance.increment as bigint),
      0n,
    );
    expect(paid).toBe(BigInt(SEASON_POOL_VOLTS * 1000));
  });

  it('scores the season from credits only, and ignores the reasons that would feed themselves', async () => {
    const { service, prisma } = buildService({ due: [WEEK], earners: [] });

    await service.closeDue(new Date('2026-09-14T00:10:00Z'));

    const where = prisma.ledgerEntry.groupBy.mock.calls[0][0].where;
    expect(where.deltaMilli).toEqual({ gt: 0 });
    expect(where.reason.notIn).toContain('SEASON_REWARD');
    expect(where.reason.notIn).toContain('ADMIN_ADJUST');
    expect(where.user).toEqual({ isBlocked: false });
    // The fixed window, not a rolling one.
    expect(where.createdAt).toEqual({ gte: WEEK.startsAt, lt: WEEK.endsAt });
  });
});

describe('SeasonsService.roll', () => {
  it('opens the previous week as well as the current one, so a deploy gap still pays', async () => {
    const { service, prisma } = buildService({ due: [] });

    await service.roll(new Date('2026-09-12T09:00:00Z'));

    const opened = prisma.season.create.mock.calls.map((c) => c[0].data.weekKey);
    expect(opened).toEqual(['2026-W36', '2026-W37']);
  });

  it('re-reads rather than failing when another instance opened the week first', async () => {
    const { service, prisma } = buildService({ due: [] });
    prisma.season.create.mockRejectedValueOnce(duplicate());

    await expect(service.roll(new Date('2026-09-12T09:00:00Z'))).resolves.toBeUndefined();
    expect(prisma.season.findUniqueOrThrow).toHaveBeenCalled();
  });
});
