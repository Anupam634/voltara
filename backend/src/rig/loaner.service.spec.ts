import { LoanerService, LOANER_HOURS, LOANER_PART_CODE, LOANER_WARN_HOURS } from './loaner.service';

/**
 * The grant and the nudge both talk to Postgres, so what is pinned here is
 * the decision each makes given what the database answered — the idempotency
 * guard, the missing-catalogue path, and the fact that neither can throw into
 * a signup. The SQL itself needs a real database and is not covered.
 */

type Tx = {
  user: { findUnique: jest.Mock; update: jest.Mock };
  boosterPlan: { findUnique: jest.Mock };
  booster: { create: jest.Mock };
  ledgerEntry: { create: jest.Mock };
};

function buildTx(overrides: Partial<Record<string, unknown>> = {}): Tx {
  return {
    user: {
      findUnique: jest.fn(async () => ({ loanerGrantedAt: null })),
      update: jest.fn(async () => ({})),
    },
    boosterPlan: {
      findUnique: jest.fn(async () => ({ id: 'plan-vc1' })),
    },
    booster: {
      create: jest.fn(async () => ({ id: 'booster-1' })),
    },
    ledgerEntry: {
      create: jest.fn(async () => ({})),
    },
    ...overrides,
  } as Tx;
}

/** One expiring loaner as `warnExpiring` selects it. */
interface ExpiringRow {
  id: string;
  expiresAt: Date;
  userId: string;
  user: { email: string | null };
}

function buildService(autoInstall: number | null = 0) {
  const rig = { autoInstall: jest.fn(async () => autoInstall) };
  const prisma = {
    booster: { findMany: jest.fn<Promise<ExpiringRow[]>, []>(async () => []) },
    ledgerEntry: {
      updateMany: jest.fn<Promise<{ count: number }>, [unknown]>(async () => ({ count: 1 })),
    },
  };
  const email = {
    sendLoanerExpiryEmail: jest.fn<
      Promise<boolean>,
      [string, { hoursLeft: number; shopUrl: string }]
    >(async () => true),
  };
  const service = new LoanerService(prisma as never, rig as never, email as never);
  return { service, rig, prisma, email };
}

describe('loaner constants', () => {
  it('lends the entry-level core, the one sized to run on a bare chassis', () => {
    expect(LOANER_PART_CODE).toBe('VC1');
  });

  it('runs for three days and warns with half a day to spare', () => {
    expect(LOANER_HOURS).toBe(72);
    expect(LOANER_WARN_HOURS).toBe(12);
    expect(LOANER_WARN_HOURS).toBeLessThan(LOANER_HOURS);
  });
});

describe('LoanerService.grant', () => {
  it('lends a core, installs it, and stamps the account', async () => {
    const { service, rig } = buildService(0);
    const tx = buildTx();

    await expect(service.grant(tx as never, 'u1')).resolves.toBe(true);

    expect(tx.booster.create).toHaveBeenCalledTimes(1);
    const created = tx.booster.create.mock.calls[0][0];
    expect(created.data.source).toBe('LOANER');
    expect(created.data.userId).toBe('u1');

    // 72h out, to the minute.
    const expiresAt: Date = created.data.expiresAt;
    const hours = (expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(LOANER_HOURS - 0.1);
    expect(hours).toBeLessThan(LOANER_HOURS + 0.1);

    expect(rig.autoInstall).toHaveBeenCalledWith(tx, 'u1', 'booster-1');
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.user.update.mock.calls[0][0].data.loanerGrantedAt).toBeInstanceOf(Date);
  });

  it('writes a zero-delta WELCOME row rather than crediting points', async () => {
    const { service } = buildService();
    const tx = buildTx();

    await service.grant(tx as never, 'u1');

    const entry = tx.ledgerEntry.create.mock.calls[0][0];
    expect(entry.data.reason).toBe('WELCOME');
    expect(entry.data.deltaMilli).toBe(0n);
    expect(entry.data.meta.loaner).toBe('VC1');
  });

  it('never lends a second core', async () => {
    const { service } = buildService();
    const tx = buildTx({
      user: {
        findUnique: jest.fn(async () => ({ loanerGrantedAt: new Date() })),
        update: jest.fn(async () => ({})),
      },
    });

    await expect(service.grant(tx as never, 'u1')).resolves.toBe(false);
    expect(tx.booster.create).not.toHaveBeenCalled();
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('declines quietly when the catalogue has no VC-1 to lend', async () => {
    const { service } = buildService();
    const tx = buildTx({
      boosterPlan: { findUnique: jest.fn(async () => null) },
    });

    await expect(service.grant(tx as never, 'u1')).resolves.toBe(false);
    expect(tx.booster.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('swallows a database failure so a signup still completes', async () => {
    const { service } = buildService();
    const tx = buildTx({
      booster: {
        create: jest.fn(async () => {
          throw new Error('unique constraint');
        }),
      },
    });

    await expect(service.grant(tx as never, 'u1')).resolves.toBe(false);
    // The stamp must not be set for a grant that blew up, or the miner
    // silently loses their one shot at a starter core.
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('still lends the part when every slot is somehow taken', async () => {
    const { service } = buildService(null);
    const tx = buildTx();

    await expect(service.grant(tx as never, 'u1')).resolves.toBe(true);
    expect(tx.ledgerEntry.create.mock.calls[0][0].data.meta.slot).toBeNull();
  });
});

describe('LoanerService.warnExpiring', () => {
  it('does nothing when no loaner is close to burning out', async () => {
    const { service, email } = buildService();

    await service.warnExpiring();

    expect(email.sendLoanerExpiryEmail).not.toHaveBeenCalled();
  });

  it('mails the miner once and marks the ledger row', async () => {
    const { service, prisma, email } = buildService();
    const expiresAt = new Date(Date.now() + 6 * 3_600_000);
    prisma.booster.findMany.mockResolvedValue([
      { id: 'b1', expiresAt, userId: 'u1', user: { email: 'a@example.com' } },
    ]);
    prisma.ledgerEntry.updateMany.mockResolvedValue({ count: 1 });

    await service.warnExpiring();

    expect(email.sendLoanerExpiryEmail).toHaveBeenCalledTimes(1);
    expect(email.sendLoanerExpiryEmail).toHaveBeenCalledWith(
      'a@example.com',
      expect.objectContaining({ hoursLeft: 6 }),
    );
  });

  it('skips a miner another instance already claimed', async () => {
    const { service, prisma, email } = buildService();
    prisma.booster.findMany.mockResolvedValue([
      {
        id: 'b1',
        expiresAt: new Date(Date.now() + 3 * 3_600_000),
        userId: 'u1',
        user: { email: 'a@example.com' },
      },
    ]);
    // Zero rows updated: the flag was already set.
    prisma.ledgerEntry.updateMany.mockResolvedValue({ count: 0 });

    await service.warnExpiring();

    expect(email.sendLoanerExpiryEmail).not.toHaveBeenCalled();
  });
});
