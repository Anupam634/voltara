import { settleDuel } from './duels.engine';

describe('settleDuel', () => {
  it('moves stakeBp of the loser score to the winner', () => {
    const r = settleDuel({
      challengerScoreMilli: 50_000n,
      opponentScoreMilli: 20_000n,
      challengerBalanceMilli: 1_000_000n,
      opponentBalanceMilli: 1_000_000n,
      stakeBp: 1000,
    });
    expect(r.winner).toBe('challenger');
    expect(r.transferMilli).toBe(2_000n);
  });

  it('caps the transfer at what the loser holds', () => {
    const r = settleDuel({
      challengerScoreMilli: 10_000n,
      opponentScoreMilli: 90_000n,
      challengerBalanceMilli: 500n,
      opponentBalanceMilli: 0n,
      stakeBp: 1000,
    });
    expect(r.winner).toBe('opponent');
    expect(r.transferMilli).toBe(500n);
  });

  it('transfers nothing on a tie', () => {
    const r = settleDuel({
      challengerScoreMilli: 7n,
      opponentScoreMilli: 7n,
      challengerBalanceMilli: 100n,
      opponentBalanceMilli: 100n,
      stakeBp: 1000,
    });
    expect(r.winner).toBeNull();
    expect(r.transferMilli).toBe(0n);
  });

  it('never goes negative with a zero score or balance', () => {
    const r = settleDuel({
      challengerScoreMilli: 1n,
      opponentScoreMilli: 0n,
      challengerBalanceMilli: 0n,
      opponentBalanceMilli: -5n,
      stakeBp: 1000,
    });
    expect(r.winner).toBe('challenger');
    expect(r.transferMilli).toBe(0n);
  });

  it('clamps an out-of-range stake', () => {
    const r = settleDuel({
      challengerScoreMilli: 0n,
      opponentScoreMilli: 10_000n,
      challengerBalanceMilli: 10_000n,
      opponentBalanceMilli: 10_000n,
      stakeBp: 50_000,
    });
    // 100% of the loser's score, capped at balance.
    expect(r.transferMilli).toBe(0n);
  });
});
