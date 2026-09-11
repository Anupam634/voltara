import { readPayoutWindow } from './payout-window';

const LAUNCH = '2026-12-01T00:00:00.000Z';
const before = new Date('2026-11-30T23:59:59.000Z');
const after = new Date('2026-12-01T00:00:01.000Z');

describe('readPayoutWindow', () => {
  it('is closed when nothing is configured', () => {
    // The default matters more than any other case here: a deploy that
    // forgets the variable must not start escrowing balances.
    expect(readPayoutWindow({})).toEqual({ open: false, opensAt: null });
  });

  it('opens on an explicit flag', () => {
    expect(readPayoutWindow({ PAYOUTS_OPEN: 'true' }).open).toBe(true);
    expect(readPayoutWindow({ PAYOUTS_OPEN: ' YES ' }).open).toBe(true);
    expect(readPayoutWindow({ PAYOUTS_OPEN: '1' }).open).toBe(true);
  });

  it('opens once the announced date has passed', () => {
    expect(readPayoutWindow({ PAYOUTS_OPEN_AT: LAUNCH }, before)).toEqual({
      open: false,
      opensAt: LAUNCH,
    });
    expect(readPayoutWindow({ PAYOUTS_OPEN_AT: LAUNCH }, after)).toEqual({
      open: true,
      opensAt: LAUNCH,
    });
  });

  it('lets an explicit false beat the date', () => {
    // The kill switch has to win. If a launch has to be rolled back, the
    // date is already in the past and cannot be un-passed.
    expect(
      readPayoutWindow({ PAYOUTS_OPEN: 'false', PAYOUTS_OPEN_AT: LAUNCH }, after),
    ).toEqual({ open: false, opensAt: LAUNCH });
  });

  it('ignores a date it cannot parse instead of treating it as passed', () => {
    expect(readPayoutWindow({ PAYOUTS_OPEN_AT: 'soon' })).toEqual({
      open: false,
      opensAt: null,
    });
    expect(readPayoutWindow({ PAYOUTS_OPEN_AT: '   ' })).toEqual({
      open: false,
      opensAt: null,
    });
  });

  it('keeps the announced date visible while still closed', () => {
    // The withdraw screen says "opens on <date>", so the date has to survive
    // the closed path, not just the open one.
    expect(readPayoutWindow({ PAYOUTS_OPEN_AT: LAUNCH }, before).opensAt).toBe(
      LAUNCH,
    );
  });
});
