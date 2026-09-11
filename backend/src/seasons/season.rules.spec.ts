import {
  PRIZE_VOLTS,
  SEASON_POOL_VOLTS,
  SEASON_SIZE,
  prizeForRank,
  prizeMilliForRank,
  previousSeason,
  rankSeason,
  seasonFor,
} from './season.rules';

describe('season windows', () => {
  it('runs Monday to Monday in UTC', () => {
    const s = seasonFor(new Date('2026-09-12T15:30:00Z')); // a Saturday
    expect(s.key).toBe('2026-W37');
    expect(s.startsAt.toISOString()).toBe('2026-09-07T00:00:00.000Z');
    expect(s.endsAt.toISOString()).toBe('2026-09-14T00:00:00.000Z');
  });

  it('treats Monday midnight as the start of the new season, not the end of the old', () => {
    // The close job runs minutes after this instant; if the boundary were
    // inclusive at the top, the first seconds of a season would be scored
    // into the one that just paid out.
    expect(seasonFor(new Date('2026-09-14T00:00:00Z')).key).toBe('2026-W38');
    expect(seasonFor(new Date('2026-09-13T23:59:59Z')).key).toBe('2026-W37');
  });

  it('finds the season that just ended, across a year boundary', () => {
    const prev = previousSeason(new Date('2026-01-01T09:00:00Z'));
    expect(prev.key).toBe('2025-W52');
    expect(prev.endsAt.toISOString()).toBe('2025-12-29T00:00:00.000Z');
  });
});

describe('prizes', () => {
  it('pays ten places and nothing outside them', () => {
    expect(PRIZE_VOLTS).toHaveLength(SEASON_SIZE);
    expect(prizeForRank(1)).toBe(200);
    expect(prizeForRank(10)).toBe(25);
    expect(prizeForRank(11)).toBe(0);
    expect(prizeForRank(0)).toBe(0);
    expect(prizeForRank(1.5)).toBe(0);
  });

  it('never pays more than the advertised pool', () => {
    const total = Array.from({ length: SEASON_SIZE }, (_, i) => prizeForRank(i + 1));
    expect(total.reduce((a, b) => a + b, 0)).toBe(SEASON_POOL_VOLTS);
    expect(SEASON_POOL_VOLTS).toBe(625);
  });

  it('converts to whole milli-points', () => {
    expect(prizeMilliForRank(1)).toBe(200_000n);
    expect(prizeMilliForRank(99)).toBe(0n);
  });
});

describe('rankSeason', () => {
  const rows = [
    { userId: 'b', earnedMilli: 5_000n },
    { userId: 'a', earnedMilli: 9_000n },
    { userId: 'c', earnedMilli: 5_000n },
  ];

  it('ranks by earnings and attaches the prize', () => {
    const placings = rankSeason(rows);

    expect(placings.map((p) => p.userId)).toEqual(['a', 'b', 'c']);
    expect(placings[0]).toMatchObject({ rank: 1, prizeMilli: 200_000n });
    expect(placings[1]).toMatchObject({ rank: 2, prizeMilli: 120_000n });
  });

  it('breaks ties the same way every time it runs', () => {
    // A close that retries must not reshuffle two equal miners — the second
    // run would pay different people for the same week.
    const once = rankSeason(rows);
    const again = rankSeason([...rows].reverse());

    expect(again.map((p) => p.userId)).toEqual(once.map((p) => p.userId));
  });

  it('drops miners who earned nothing rather than paying a zero row', () => {
    const placings = rankSeason([
      { userId: 'a', earnedMilli: 1_000n },
      { userId: 'idle', earnedMilli: 0n },
    ]);

    expect(placings).toHaveLength(1);
    expect(placings[0].userId).toBe('a');
  });

  it('pays at most the season size', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      userId: `u${String(i).padStart(2, '0')}`,
      earnedMilli: BigInt(1000 * (25 - i)),
    }));

    expect(rankSeason(many)).toHaveLength(SEASON_SIZE);
  });
});
