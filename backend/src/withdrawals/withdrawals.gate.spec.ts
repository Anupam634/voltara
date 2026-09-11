import { WithdrawalsService } from './withdrawals.service';

/**
 * The payout window, where it actually bites.
 *
 * `payout-window.spec.ts` pins how the environment is read; this pins the
 * consequence: a closed window must refuse *before* the transaction runs.
 * Accepting a request debits the miner's balance into escrow, so a gate that
 * fires after the debit — or only in the UI — would take real balance out of
 * circulation with no payout able to release it.
 */

function build(env: Record<string, string | undefined>) {
  const prisma = { $transaction: jest.fn(async () => ({})) };
  const wallet = {};
  const config = { get: (key: string) => env[key] };

  const service = new WithdrawalsService(
    prisma as never,
    wallet as never,
    config as never,
  );
  return { service, prisma };
}

const ONE_HUNDRED_POINTS = 100 * 1000; // milli-points
const ADDRESS = '0x1111111111111111111111111111111111111111';

describe('withdrawal requests against the payout window', () => {
  it('refuses without touching the database when payouts are closed', async () => {
    const { service, prisma } = build({});

    await expect(
      service.request('u1', ADDRESS, ONE_HUNDRED_POINTS),
    ).rejects.toThrow(/token launch/i);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses a closed window before the minimum-amount check', async () => {
    // Order matters for the message the miner sees: "payouts open at launch"
    // is the true reason, and "minimum is 100 points" would send them off to
    // mine more for a window that is shut either way.
    const { service } = build({});

    await expect(service.request('u1', ADDRESS, 1)).rejects.toThrow(
      /token launch/i,
    );
  });

  it('lets the request through once the window is open', async () => {
    const { service, prisma } = build({ PAYOUTS_OPEN: 'true' });

    await service.request('u1', ADDRESS, ONE_HUNDRED_POINTS);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('opens on the announced date without a redeploy', async () => {
    const { service, prisma } = build({
      PAYOUTS_OPEN_AT: '2020-01-01T00:00:00.000Z',
    });

    await service.request('u1', ADDRESS, ONE_HUNDRED_POINTS);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
