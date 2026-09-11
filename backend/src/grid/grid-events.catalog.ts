/**
 * The grid events the scheduler can roll.
 *
 * Multipliers are basis points (10000 = ×1) and land on every rig on the
 * grid for the event's window — see rig.engine.ts `RigModifiers`. Each one
 * is meant to make a different part class matter for a few hours: a
 * heatwave rewards whoever bought cooling, cheap power rewards big cores,
 * grid strain punishes anyone running close to their PSU budget.
 */
export interface GridEventSpec {
  code: GridEventCode;
  title: string;
  body: string;
  heatMultBp: number;
  drawMultBp: number;
  hashMultBp: number;
}

export type GridEventCode =
  | 'HEATWAVE'
  | 'COLD_SNAP'
  | 'CHEAP_POWER'
  | 'GRID_STRAIN'
  | 'SOLAR_SURGE';

export const BP_ONE = 10_000;

export const GRID_EVENT_CATALOG: readonly GridEventSpec[] = [
  {
    code: 'HEATWAVE',
    title: 'Heatwave — every core runs 30% hotter',
    body: 'Ambient temperature is up across the grid. Cooling headroom decides who keeps 100% stability.',
    heatMultBp: 13_000,
    drawMultBp: BP_ONE,
    hashMultBp: BP_ONE,
  },
  {
    code: 'COLD_SNAP',
    title: 'Cold snap — heat output down 30%',
    body: 'The grid is running cold. Rigs that normally throttle on heat get a few hours of clean air.',
    heatMultBp: 7_000,
    drawMultBp: BP_ONE,
    hashMultBp: BP_ONE,
  },
  {
    code: 'CHEAP_POWER',
    title: 'Cheap power — every part draws half',
    body: 'Off-peak supply floods the grid. Power draw is halved, so the biggest cores finally fit the budget.',
    heatMultBp: BP_ONE,
    drawMultBp: 5_000,
    hashMultBp: BP_ONE,
  },
  {
    code: 'GRID_STRAIN',
    title: 'Grid strain — draw up 40%, hash up 10%',
    body: 'Demand is spiking. Every part pulls 40% more power; anyone still inside their PSU budget mines 10% faster.',
    heatMultBp: BP_ONE,
    drawMultBp: 14_000,
    hashMultBp: 11_000,
  },
  {
    code: 'SOLAR_SURGE',
    title: 'Solar surge — hash up 50%',
    body: 'A surge on the grid. Every stable rig makes 50% more hash for the duration.',
    heatMultBp: BP_ONE,
    drawMultBp: BP_ONE,
    hashMultBp: 15_000,
  },
];

export function specFor(code: string): GridEventSpec | undefined {
  return GRID_EVENT_CATALOG.find((s) => s.code === code);
}

/** Basis points → signed whole percent, e.g. 13000 → 30, 5000 → -50. */
export function bpToPercent(bp: number): number {
  return Math.round(((bp - BP_ONE) / BP_ONE) * 100);
}

/**
 * Pick the next event code. Never repeats the most recent one so the grid
 * does not run two heatwaves back to back. `rand` is injected so the choice
 * can be tested with a fixed value.
 */
export function pickNextCode(lastCode: string | null, rand = Math.random): GridEventCode {
  const pool = GRID_EVENT_CATALOG.filter((s) => s.code !== lastCode);
  const i = Math.min(pool.length - 1, Math.max(0, Math.floor(rand() * pool.length)));
  return pool[i].code;
}

/** Hours until the next event starts, and how long it runs. */
export const NEXT_EVENT_MIN_H = 36;
export const NEXT_EVENT_MAX_H = 72;
export const EVENT_MIN_H = 4;
export const EVENT_MAX_H = 8;

/** Window for a freshly scheduled event, relative to `now`. */
export function scheduleWindow(now: Date, rand = Math.random): { startsAt: Date; endsAt: Date } {
  const leadH = NEXT_EVENT_MIN_H + rand() * (NEXT_EVENT_MAX_H - NEXT_EVENT_MIN_H);
  const durH = EVENT_MIN_H + rand() * (EVENT_MAX_H - EVENT_MIN_H);
  const startsAt = new Date(now.getTime() + Math.round(leadH * 3_600_000));
  const endsAt = new Date(startsAt.getTime() + Math.round(durH * 3_600_000));
  return { startsAt, endsAt };
}
