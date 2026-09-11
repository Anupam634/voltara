import { daysLeft, listable, MARKET_FEE_BP, splitSale } from './market.rules';

describe('splitSale', () => {
  it('keeps 5% and hands the seller the rest', () => {
    const { sellerMilli, feeMilli } = splitSale(100_000n);
    expect(feeMilli).toBe(5_000n);
    expect(sellerMilli).toBe(95_000n);
  });

  it('always adds back up to the price, rounding the fee down', () => {
    for (const price of [1n, 7n, 999n, 1_000n, 123_457n, 100_000_000n]) {
      const { sellerMilli, feeMilli } = splitSale(price);
      expect(sellerMilli + feeMilli).toBe(price);
      expect(feeMilli).toBe((price * BigInt(MARKET_FEE_BP)) / 10_000n);
    }
  });

  it('charges no fee on a price too small to split', () => {
    expect(splitSale(10n)).toEqual({ sellerMilli: 10n, feeMilli: 0n });
  });
});

describe('daysLeft / listable', () => {
  const now = new Date('2026-09-12T12:00:00Z');

  it('floors partial days and never goes negative', () => {
    expect(daysLeft(new Date('2026-09-15T11:59:00Z'), now)).toBe(2);
    expect(daysLeft(new Date('2026-09-10T00:00:00Z'), now)).toBe(0);
  });

  it('needs strictly more than three days left', () => {
    expect(listable(new Date('2026-09-15T12:00:00Z'), now)).toBe(false);
    expect(listable(new Date('2026-09-15T12:00:01Z'), now)).toBe(true);
  });
});
