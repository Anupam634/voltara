import {
  challengeFor,
  compareSubmissions,
  isoWeek,
  rankSubmissions,
  TARGETS_PER_HOUR,
  weekKey,
  weekStart,
} from './challenge.rules';

describe('ISO weeks', () => {
  it('starts the week on Monday 00:00 UTC', () => {
    // 2026-09-12 is a Saturday.
    expect(weekStart(new Date('2026-09-12T15:30:00Z')).toISOString()).toBe('2026-09-07T00:00:00.000Z');
    // Monday itself is its own start.
    expect(weekStart(new Date('2026-09-07T00:00:00Z')).toISOString()).toBe('2026-09-07T00:00:00.000Z');
    // Sunday belongs to the week that began the previous Monday.
    expect(weekStart(new Date('2026-09-13T23:59:59Z')).toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });

  it('numbers weeks the ISO way, including year boundaries', () => {
    expect(weekKey(new Date('2026-09-12T00:00:00Z'))).toBe('2026-W37');
    // 2021-01-01 is a Friday and belongs to 2020-W53.
    expect(weekKey(new Date('2021-01-01T00:00:00Z'))).toBe('2020-W53');
    // 2024-12-30 is a Monday in 2025-W01.
    expect(weekKey(new Date('2024-12-30T00:00:00Z'))).toBe('2025-W01');
    expect(isoWeek(new Date('2026-01-01T00:00:00Z'))).toEqual({ year: 2026, week: 1 });
  });

  it('builds a seven-day challenge whose target rotates with the week', () => {
    const c = challengeFor(new Date('2026-09-12T00:00:00Z'));
    expect(c.weekKey).toBe('2026-W37');
    expect(c.endsAt.getTime() - c.startsAt.getTime()).toBe(7 * 86_400_000);
    expect(c.targetPerHour).toBe(TARGETS_PER_HOUR[(37 - 1) % TARGETS_PER_HOUR.length]);
    expect(c.title).toContain(`${c.targetPerHour} hash/h`);
    const next = challengeFor(new Date('2026-09-14T00:00:00Z'));
    expect(next.weekKey).toBe('2026-W38');
    expect(next.targetPerHour).not.toBe(c.targetPerHour);
  });
});

describe('ranking', () => {
  const t0 = new Date('2026-09-08T10:00:00Z');
  const t1 = new Date('2026-09-09T10:00:00Z');

  it('orders by cost, then hash, then time', () => {
    const rows = [
      { id: 'late-cheap', costUsd: 6, hashMilli: 12_000, createdAt: t1 },
      { id: 'early-cheap', costUsd: 6, hashMilli: 12_000, createdAt: t0 },
      { id: 'cheap-strong', costUsd: 6, hashMilli: 15_000, createdAt: t1 },
      { id: 'pricey', costUsd: 11, hashMilli: 40_000, createdAt: t0 },
    ];
    const ranked = rankSubmissions(rows);
    expect(ranked.map((r) => r.id)).toEqual(['cheap-strong', 'early-cheap', 'late-cheap', 'pricey']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('is a consistent comparator', () => {
    const a = { costUsd: 6, hashMilli: 12_000, createdAt: t0 };
    const b = { costUsd: 6, hashMilli: 12_000, createdAt: t0 };
    expect(compareSubmissions(a, b)).toBe(0);
    expect(Math.sign(compareSubmissions(a, { ...b, costUsd: 5 }))).toBe(1);
    expect(Math.sign(compareSubmissions({ ...b, costUsd: 5 }, a))).toBe(-1);
  });
});
