import { rigTelemetry, type RigPart, type RigPartKind } from '../mining/rig.engine';
import {
  beatPercent,
  compareSubmissions,
  costDistribution,
  DAILY_EPOCH_MS,
  DAILY_PUZZLES,
  dayKey,
  dayNumber,
  dayStart,
  daySeed,
  MAX_PARTS,
  puzzleFor,
  rankSubmissions,
  shareBlock,
} from './daily.rules';

/**
 * The catalogue, mirrored from `prisma/seed.js`.
 *
 * Only used to prove every puzzle in the rotation is actually solvable. If
 * the seed is repriced and this drifts, the solvability test below starts
 * failing — which is the point: a puzzle nobody can solve is worse than no
 * puzzle at all.
 */
const CATALOGUE: Record<string, Omit<RigPart, 'expiresAt'> & { priceUsd: number }> = {
  VC1: { priceUsd: 1, kind: 'CORE', hashMilli: 2_000, heat: 10, cooling: 0, watts: 45, wattsSupplied: 0, hashBoostBp: 0 },
  VC5: { priceUsd: 5, kind: 'CORE', hashMilli: 10_000, heat: 26, cooling: 0, watts: 110, wattsSupplied: 0, hashBoostBp: 0 },
  VC10: { priceUsd: 10, kind: 'CORE', hashMilli: 20_000, heat: 48, cooling: 0, watts: 200, wattsSupplied: 0, hashBoostBp: 0 },
  VC50: { priceUsd: 50, kind: 'CORE', hashMilli: 90_000, heat: 190, cooling: 0, watts: 760, wattsSupplied: 0, hashBoostBp: 0 },
  CX2: { priceUsd: 2, kind: 'COOLER', hashMilli: 0, heat: 0, cooling: 40, watts: 18, wattsSupplied: 0, hashBoostBp: 0 },
  CX6: { priceUsd: 6, kind: 'COOLER', hashMilli: 0, heat: 0, cooling: 120, watts: 40, wattsSupplied: 0, hashBoostBp: 0 },
  CX20: { priceUsd: 20, kind: 'COOLER', hashMilli: 0, heat: 0, cooling: 420, watts: 90, wattsSupplied: 0, hashBoostBp: 0 },
  PS3: { priceUsd: 3, kind: 'PSU', hashMilli: 0, heat: 4, cooling: 0, watts: 0, wattsSupplied: 260, hashBoostBp: 0 },
  PS12: { priceUsd: 12, kind: 'PSU', hashMilli: 0, heat: 12, cooling: 0, watts: 0, wattsSupplied: 900, hashBoostBp: 0 },
  OD8: { priceUsd: 8, kind: 'MODULE', hashMilli: 0, heat: 14, cooling: 0, watts: 30, wattsSupplied: 0, hashBoostBp: 1_500 },
};

const FAR_FUTURE = new Date('2999-01-01T00:00:00Z');

function score(codes: string[]) {
  const parts: RigPart[] = codes.map((c) => {
    const p = CATALOGUE[c];
    if (!p) throw new Error(`unknown reference code ${c}`);
    return { ...p, kind: p.kind as RigPartKind, expiresAt: FAR_FUTURE };
  });
  const costUsd = codes.reduce((s, c) => s + CATALOGUE[c].priceUsd, 0);
  return { costUsd, telemetry: rigTelemetry({ parts }) };
}

describe('UTC days', () => {
  it('starts the day at midnight UTC', () => {
    expect(dayStart(new Date('2026-09-12T23:59:59Z')).toISOString()).toBe('2026-09-12T00:00:00.000Z');
    expect(dayStart(new Date('2026-09-12T00:00:00Z')).toISOString()).toBe('2026-09-12T00:00:00.000Z');
  });

  it('keys a day the way a human writes it', () => {
    expect(dayKey(new Date('2026-09-12T10:00:00Z'))).toBe('2026-09-12');
    expect(dayKey(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05');
    expect(dayKey(new Date('2026-12-31T23:00:00Z'))).toBe('2026-12-31');
  });

  it('numbers puzzles from the fixed epoch', () => {
    expect(dayNumber(new Date(DAILY_EPOCH_MS))).toBe(1);
    expect(dayNumber(new Date('2026-09-12T12:00:00Z'))).toBe(214);
    // Consecutive days advance by exactly one.
    expect(dayNumber(new Date('2026-09-13T00:00:00Z'))).toBe(215);
  });
});

describe('puzzleFor', () => {
  it('is deterministic — two calls on the same day agree exactly', () => {
    const a = puzzleFor(new Date('2026-09-12T00:00:01Z'));
    const b = puzzleFor(new Date('2026-09-12T23:59:59Z'));
    expect(a).toEqual(b);
  });

  it('spans exactly one day', () => {
    const p = puzzleFor(new Date('2026-09-12T12:00:00Z'));
    expect(p.startsAt.toISOString()).toBe('2026-09-12T00:00:00.000Z');
    expect(p.endsAt.toISOString()).toBe('2026-09-13T00:00:00.000Z');
  });

  it('marches through the rotation in order', () => {
    const days = Array.from({ length: DAILY_PUZZLES.length + 1 }, (_, i) =>
      puzzleFor(new Date(DAILY_EPOCH_MS + i * 86_400_000)),
    );
    expect(days.map((d) => d.budgetUsd)).toEqual([
      ...DAILY_PUZZLES.map((p) => p.budgetUsd),
      DAILY_PUZZLES[0].budgetUsd,
    ]);
  });

  it('states the target in both units', () => {
    const p = puzzleFor(new Date('2026-09-12T00:00:00Z'));
    expect(p.targetHashMilli).toBe(p.targetPerHour * 1000);
  });

  it('seeds from the day key, not the clock', () => {
    expect(puzzleFor(new Date('2026-09-12T03:00:00Z')).seed).toBe(daySeed('2026-09-12'));
    expect(daySeed('2026-09-12')).not.toBe(daySeed('2026-09-13'));
  });
});

describe('every puzzle is solvable', () => {
  it.each(DAILY_PUZZLES.map((p, i) => [i, p] as const))(
    'rotation %i: the reference build fits the budget and hits the target at 100%%',
    (_i, spec) => {
      expect(spec.reference.length).toBeLessThanOrEqual(MAX_PARTS);
      const { costUsd, telemetry } = score(spec.reference);
      expect(costUsd).toBeLessThanOrEqual(spec.budgetUsd);
      expect(telemetry.gridStability).toBe(100);
      expect(telemetry.hashMilli).toBeGreaterThanOrEqual(spec.targetPerHour * 1000);
    },
  );
});

describe('shareBlock', () => {
  it('renders the two-line block from the brief', () => {
    expect(
      shareBlock({ number: 214, costUsd: 9, gridStability: 100, kinds: ['CORE', 'CORE', 'COOLER', 'PSU'] }),
    ).toBe('VOLTARA #214   $9   100%\n🟪🟪🟦🟩⬜⬜');
  });

  it('always draws six sockets, padding the empties', () => {
    const block = shareBlock({ number: 1, costUsd: 4, gridStability: 100, kinds: ['CORE'] });
    const glyphs = block.split('\n')[1];
    expect([...glyphs]).toHaveLength(6);
    expect(glyphs).toBe('🟪⬜⬜⬜⬜⬜');
  });

  it('ignores anything past the sixth socket', () => {
    const kinds = Array(9).fill('CORE');
    const glyphs = shareBlock({ number: 2, costUsd: 9, gridStability: 100, kinds }).split('\n')[1];
    expect([...glyphs]).toHaveLength(6);
  });

  it('falls back to an empty socket for an unknown kind', () => {
    const glyphs = shareBlock({ number: 3, costUsd: 1, gridStability: 100, kinds: ['WIDGET'] }).split('\n')[1];
    expect(glyphs.startsWith('⬜')).toBe(true);
  });

  it('carries no URL, so the client owns the link', () => {
    const block = shareBlock({ number: 214, costUsd: 9, gridStability: 100, kinds: ['CORE'] });
    expect(block).not.toMatch(/https?:/);
    expect(block.split('\n')).toHaveLength(2);
  });
});

describe('ranking', () => {
  const t0 = new Date('2026-09-12T10:00:00Z');
  const t1 = new Date('2026-09-12T11:00:00Z');

  it('orders by cost, then hash, then time', () => {
    const rows = [
      { id: 'late-cheap', costUsd: 6, hashMilli: 12_000, createdAt: t1 },
      { id: 'early-cheap', costUsd: 6, hashMilli: 12_000, createdAt: t0 },
      { id: 'cheap-strong', costUsd: 6, hashMilli: 15_000, createdAt: t1 },
      { id: 'pricey', costUsd: 11, hashMilli: 40_000, createdAt: t0 },
    ];
    expect(rankSubmissions(rows).map((r) => r.id)).toEqual([
      'cheap-strong',
      'early-cheap',
      'late-cheap',
      'pricey',
    ]);
  });

  it('is a consistent comparator', () => {
    const a = { costUsd: 6, hashMilli: 12_000, createdAt: t0 };
    expect(compareSubmissions(a, { ...a })).toBe(0);
    expect(Math.sign(compareSubmissions(a, { ...a, costUsd: 5 }))).toBe(1);
  });
});

describe('beatPercent', () => {
  const t0 = new Date('2026-09-12T10:00:00Z');
  const mine = { costUsd: 6, hashMilli: 12_000, createdAt: t0 };

  it('credits a lone solver with everyone they faced', () => {
    expect(beatPercent(mine, [])).toBe(100);
  });

  it('counts only the solvers this build actually beat', () => {
    const others = [
      { costUsd: 9, hashMilli: 12_000, createdAt: t0 },
      { costUsd: 8, hashMilli: 12_000, createdAt: t0 },
      { costUsd: 4, hashMilli: 12_000, createdAt: t0 },
      { costUsd: 5, hashMilli: 12_000, createdAt: t0 },
    ];
    expect(beatPercent(mine, others)).toBe(50);
  });

  it('reports zero for the worst build on the board', () => {
    expect(beatPercent(mine, [{ costUsd: 1, hashMilli: 12_000, createdAt: t0 }])).toBe(0);
  });
});

describe('costDistribution', () => {
  it('groups solvers by cost, cheapest first', () => {
    expect(
      costDistribution([{ costUsd: 9 }, { costUsd: 4 }, { costUsd: 9 }, { costUsd: 6 }]),
    ).toEqual([
      { cost: 4, count: 1 },
      { cost: 6, count: 1 },
      { cost: 9, count: 2 },
    ]);
  });

  it('is empty when nobody has solved it', () => {
    expect(costDistribution([])).toEqual([]);
  });
});

describe('daySeed fits the column it is stored in', () => {
  // `DailyPuzzle.seed` is a Prisma `Int` — a signed INT4. FNV-1a is unsigned
  // 32-bit, so an unmasked hash overflowed the column and the day's puzzle
  // silently failed to insert on roughly half of all dates.
  const INT4_MAX = 2_147_483_647;

  it('never exceeds INT4 for any day of a decade', () => {
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 3653; i += 1) {
      const key = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const seed = daySeed(key);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(INT4_MAX);
    }
  });

  it('pins the key that actually broke a running instance', () => {
    // 2026-09-11 hashed to 2,345,676,558 unmasked — the exact value the API
    // rejected on boot. 198 of 2026's 365 days (54%) overflowed the column.
    expect(daySeed('2026-09-11')).toBeLessThanOrEqual(INT4_MAX);
    expect(daySeed('2026-09-11')).toBe(2_345_676_558 & 0x7fffffff);
  });

  it('is still deterministic and still varies by day', () => {
    expect(daySeed('2026-09-12')).toBe(daySeed('2026-09-12'));
    expect(daySeed('2026-09-12')).not.toBe(daySeed('2026-09-13'));
  });
});
