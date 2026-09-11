/**
 * Pure rules for the daily rig puzzle.
 *
 * One puzzle a day, identical for every miner on the grid: a fixed budget
 * and a hash target. Build the rig inside the budget at 100% stability.
 *
 * Everything here is derived from the UTC day, so two API instances — and a
 * client guessing ahead — generate byte-identical puzzles without talking to
 * each other. Nothing is random at request time.
 *
 * The result is meant to be pasted into a chat, so the share block matters as
 * much as the puzzle: it has to survive a copy, read at a glance, and give
 * nothing away about the build beyond its shape.
 */

export const DAY_MS = 86_400_000;

/**
 * Day zero. Chosen so the puzzle number reads as a plausible running count
 * rather than starting at #1 on launch day; moving it renumbers every puzzle,
 * so it is fixed for the life of the feature.
 */
export const DAILY_EPOCH_MS = Date.UTC(2026, 1, 11);

/** A stock chassis has six sockets, so a build is at most six parts. */
export const MAX_PARTS = 6;

/** Glyph per part kind for the shareable block. Empty sockets read as white. */
export const SLOT_GLYPH: Record<string, string> = {
  CORE: '🟪',
  COOLER: '🟦',
  PSU: '🟩',
  MODULE: '🟨',
};
export const EMPTY_GLYPH = '⬜';

/**
 * The rotation.
 *
 * Every entry is solvable inside its budget on a stock chassis (12 TU
 * cooling, 120 W) at exactly 100% stability — `reference` is a build that
 * does it, and the spec re-scores each one against the real catalogue
 * figures so a mis-tuned puzzle fails the build rather than the miner.
 *
 * Nine entries rather than seven, so the cycle does not line up with the
 * week and a miner does not meet the same puzzle every Monday.
 */
export interface PuzzleSpec {
  budgetUsd: number;
  targetPerHour: number;
  /** A known solution, within budget. Documentation and test fixture. */
  reference: string[];
}

export const DAILY_PUZZLES: PuzzleSpec[] = [
  { budgetUsd: 4, targetPerHour: 4, reference: ['VC1', 'VC1', 'CX2'] },
  { budgetUsd: 8, targetPerHour: 6, reference: ['VC1', 'VC1', 'VC1', 'CX2', 'PS3'] },
  { budgetUsd: 10, targetPerHour: 10, reference: ['VC5', 'CX2', 'PS3'] },
  { budgetUsd: 13, targetPerHour: 14, reference: ['VC5', 'VC1', 'VC1', 'CX2', 'PS3'] },
  { budgetUsd: 15, targetPerHour: 20, reference: ['VC10', 'CX2', 'PS3'] },
  { budgetUsd: 21, targetPerHour: 24, reference: ['VC10', 'VC1', 'VC1', 'CX6', 'PS3'] },
  { budgetUsd: 27, targetPerHour: 23, reference: ['VC10', 'OD8', 'CX6', 'PS3'] },
  { budgetUsd: 32, targetPerHour: 40, reference: ['VC10', 'VC10', 'CX6', 'PS3', 'PS3'] },
  { budgetUsd: 37, targetPerHour: 50, reference: ['VC10', 'VC10', 'VC5', 'CX6', 'PS3', 'PS3'] },
];

/** Midnight UTC of the day containing `d`. */
export function dayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** "2026-09-12" */
export function dayKey(d: Date): string {
  const s = dayStart(d);
  const m = String(s.getUTCMonth() + 1).padStart(2, '0');
  const day = String(s.getUTCDate()).padStart(2, '0');
  return `${s.getUTCFullYear()}-${m}-${day}`;
}

/** 1-based puzzle number, so the share line reads "#214". */
export function dayNumber(d: Date): number {
  return Math.floor((dayStart(d).getTime() - DAILY_EPOCH_MS) / DAY_MS) + 1;
}

/**
 * A small deterministic hash of the day key.
 *
 * Stored on the row so a future generator can vary a puzzle without changing
 * the rotation, and so two instances writing the same day agree on it. FNV-1a
 * because it is four lines and needs no dependency.
 *
 * Masked to 31 bits, and that is load-bearing rather than tidy. FNV-1a is an
 * *unsigned* 32-bit hash, so it ranges up to 4,294,967,295 — while
 * `DailyPuzzle.seed` is a Prisma `Int`, which is a signed INT4 capped at
 * 2,147,483,647. Roughly half of all day keys therefore overflowed the column
 * and the whole day's puzzle failed to insert:
 *
 *   Unable to fit integer value '2345676558' into an INT4
 *
 * The failure was swallowed as a warning on the boot roll, so the feature
 * simply produced no puzzle on those days rather than announcing itself.
 * Dropping the top bit keeps the value non-negative, keeps it deterministic,
 * and costs one bit of a hash nothing reads yet — cheaper than a migration to
 * BigInt for a column that exists for a generator that does not exist.
 */
export function daySeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h & 0x7fffffff;
}

export interface DailySpec {
  dayKey: string;
  number: number;
  budgetUsd: number;
  targetPerHour: number;
  targetHashMilli: number;
  seed: number;
  startsAt: Date;
  endsAt: Date;
}

/** The puzzle a given instant belongs to. */
export function puzzleFor(d: Date): DailySpec {
  const startsAt = dayStart(d);
  const key = dayKey(d);
  const number = dayNumber(d);
  // Index off the puzzle number, not the seed: the rotation should march in
  // order so consecutive days feel different rather than occasionally repeat.
  const spec = DAILY_PUZZLES[((number - 1) % DAILY_PUZZLES.length + DAILY_PUZZLES.length) % DAILY_PUZZLES.length];
  return {
    dayKey: key,
    number,
    budgetUsd: spec.budgetUsd,
    targetPerHour: spec.targetPerHour,
    targetHashMilli: spec.targetPerHour * 1000,
    seed: daySeed(key),
    startsAt,
    endsAt: new Date(startsAt.getTime() + DAY_MS),
  };
}

/**
 * The block a miner pastes into a chat.
 *
 * Two lines, no URL: the client appends its own link so web, mobile and any
 * future surface can point somewhere different without the server guessing.
 *
 *   VOLTARA #214   $9   100%
 *   🟪🟪🟦🟩⬜⬜
 */
export function shareBlock(params: {
  number: number;
  costUsd: number;
  gridStability: number;
  kinds: string[];
}): string {
  const glyphs = Array.from({ length: MAX_PARTS }, (_, i) => {
    const kind = params.kinds[i];
    return (kind && SLOT_GLYPH[kind]) || EMPTY_GLYPH;
  }).join('');
  return `VOLTARA #${params.number}   $${params.costUsd}   ${params.gridStability}%\n${glyphs}`;
}

export interface Rankable {
  costUsd: number;
  hashMilli: number;
  createdAt: Date;
}

/**
 * Cheapest first; ties broken by more hash, then by who got there first.
 * Same ordering as the weekly blueprint, so the two boards read alike.
 */
export function compareSubmissions(a: Rankable, b: Rankable): number {
  if (a.costUsd !== b.costUsd) return a.costUsd - b.costUsd;
  if (a.hashMilli !== b.hashMilli) return b.hashMilli - a.hashMilli;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export function rankSubmissions<T extends Rankable>(rows: T[]): (T & { rank: number })[] {
  return [...rows].sort(compareSubmissions).map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Share of the other solvers this build beat, 0–100.
 *
 * A lone solver has beaten everyone who showed up, which is nobody, so the
 * honest answer is 100 rather than a divide by zero.
 */
export function beatPercent(mine: Rankable, others: Rankable[]): number {
  if (others.length === 0) return 100;
  const beaten = others.filter((o) => compareSubmissions(mine, o) < 0).length;
  return Math.round((beaten / others.length) * 100);
}

/** Solvers grouped by what their build cost, cheapest first. */
export function costDistribution(rows: { costUsd: number }[]): { cost: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.costUsd, (counts.get(r.costUsd) ?? 0) + 1);
  return [...counts.entries()]
    .map(([cost, count]) => ({ cost, count }))
    .sort((a, b) => a.cost - b.cost);
}
