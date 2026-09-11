/**
 * Pure rig math for the VOLTARA grid.
 *
 * A miner no longer buys a flat "booster" that adds hash and nothing else.
 * Every purchase is a PART installed into a slot on their rig, and a part
 * costs something to run: cores make heat and draw watts, coolers remove
 * heat but draw watts of their own, PSUs supply watts but add a little heat.
 * If the build is out of balance the rig throttles — the whole point of the
 * game is keeping GRID STABILITY at 100%.
 *
 * On top of the build, five MODIFIERS can change the physics:
 *   - a grid event (heatwave, cheap power, solar surge …) scales heat,
 *     draw or hash for every rig on the grid for a few hours;
 *   - overclock trades +40% hash for +80% heat and a burn risk;
 *   - a squad lends its members' spare cooling and power;
 *   - the real weather where the miner lives shifts heat by up to ±15%;
 *   - the collective grid goal adds hash when enough rigs hold 100%.
 *
 * The last two arrive already folded into `heatMultBp` / `hashMultBp` by
 * `RigContextService` (see `composeBp`); the engine only carries their
 * attribution through so the UI can name what moved the number.
 *
 * Deterministic and side-effect free so it can be unit tested in isolation.
 * Rates are MILLI-points/hour (integer) exactly like mining.engine.ts.
 *
 * Rules mirror SPEC.md §2a. If a number changes here, change it there too.
 */

/** What a part does when it is installed. */
export type RigPartKind = 'CORE' | 'COOLER' | 'PSU' | 'MODULE';

/**
 * Free capacity every rig has before a single part is bought.
 *
 * Sized so the entry-level core (VC-1: 10 heat, 45 W) runs at full stability
 * on a bare chassis — a new miner's first purchase must not immediately
 * throttle itself, or the mechanic reads as a bug rather than a build.
 */
export const CHASSIS_COOLING = 12;
export const CHASSIS_WATTS = 120;
/** Slots on a stock chassis — a 3×2 grid in the UI. */
export const CHASSIS_SLOTS = 6;
/** Hard ceiling on slots, so an admin grant can't produce an unbounded rig. */
export const MAX_SLOTS = 12;

/**
 * Worst case each penalty can drag output to.
 *
 * Neither floors at zero: a rig that has stopped earning entirely gives the
 * miner nothing to fix and no reason to come back. Overheating hurts (down
 * to a quarter of output), a brownout hurts much more (down to a tenth) —
 * that ordering is deliberate, since power is the cheaper problem to solve.
 */
export const THERMAL_FLOOR = 0.25;
export const POWER_FLOOR = 0.1;

/** Basis-point identity: ×1. */
export const BP_ONE = 10_000;

/**
 * Multiply two basis-point factors. 12000 x 11000 = 13200, not 132000000.
 *
 * Every modifier that scales the same quantity composes through this, so a
 * heatwave during a hot afternoon is 1.3 x 1.13, never 1.43 by addition.
 */
export function composeBp(a: number, b: number): number {
  return Math.round((a * b) / BP_ONE);
}

/**
 * Overclock: the risk button.
 *
 * Cores make 40% more hash and 80% more heat. Every hour it stays on, one
 * installed part has a 15% chance of burning, which disables it for 48h.
 * The heat penalty is deliberately steeper than the hash gain so a rig with
 * no cooling headroom loses by overclocking — it is a decision, not a free
 * boost.
 */
export const OVERCLOCK_HASH_BP = 14_000;
export const OVERCLOCK_HEAT_BP = 18_000;
export const OVERCLOCK_BURN_CHANCE = 0.15;
export const OVERCLOCK_BURN_HOURS = 48;
export const OVERCLOCK_MAX_HOURS = 6;

/** A part as the engine needs to see it — the DB shape is wider. */
export interface RigPart {
  kind: RigPartKind;
  /** Hash this part contributes, milli-points/hour (CORE). */
  hashMilli: number;
  /** Thermal units produced (CORE, PSU). */
  heat: number;
  /** Thermal units removed (COOLER). */
  cooling: number;
  /** Power drawn, watts (CORE, COOLER, MODULE). */
  watts: number;
  /** Power supplied, watts (PSU). */
  wattsSupplied: number;
  /** Multiplier on total core hash, in basis points (MODULE). 1500 = +15%. */
  hashBoostBp: number;
  /** When the part burns out. Expired parts contribute nothing. */
  expiresAt: Date;
  /** Burned by an overclock roll: contributes nothing until this passes. */
  disabledUntil?: Date | null;
}

/** Extra chassis capacity granted per user (admin, or legacy grandfathering). */
export interface ChassisBonus {
  coolingBonus?: number;
  powerBonus?: number;
}

/** Everything that bends the physics of one rig right now. */
export interface RigModifiers {
  /** Grid-event multiplier on every part's heat, basis points. */
  heatMultBp?: number;
  /** Grid-event multiplier on every part's draw, basis points. */
  drawMultBp?: number;
  /** Grid-event multiplier on final hash, basis points. */
  hashMultBp?: number;
  /** Overclock engaged. */
  overclock?: boolean;
  /** Cooling lent by the squad pool, thermal units. */
  squadCooling?: number;
  /** Power lent by the squad pool, watts. */
  squadPower?: number;
  /**
   * Attribution only — the engine does NOT apply these.
   *
   * `heatMultBp` and `hashMultBp` above are already the composed product of
   * every source. These two record how much of that product came from the
   * weather and from the collective grid goal, so the UI can say "your
   * coolers are working 12% harder because it is 42 °C in Delhi" instead of
   * showing one unexplained number. Composition happens in
   * `RigContextService`, which is the single place modifiers are assembled.
   */
  weatherHeatBp?: number;
  collectiveHashBp?: number;
}

export interface RigTelemetry {
  /** Hash from installed cores, after MODULE boosts and modifiers. Milli-points/hour. */
  hashMilli: number;
  /** Raw hash before MODULE boosts — shown so the boost is legible. */
  baseHashMilli: number;
  heatLoad: number;
  coolingCapacity: number;
  powerDraw: number;
  powerSupply: number;
  /** 0–1. How much of the heat the cooling covers. */
  thermalEfficiency: number;
  /** 0–1. How much of the draw the supply covers. */
  powerEfficiency: number;
  /** thermalEfficiency × powerEfficiency, as a 0–100 whole number. */
  gridStability: number;
  overheating: boolean;
  brownout: boolean;
  installedCount: number;
  /** Installed parts currently burned out by an overclock roll. */
  disabledCount: number;
  /** Cooling the rig is not using — what it could lend a squad. */
  coolingSurplus: number;
  /** Power the rig is not using — what it could lend a squad. */
  powerSurplus: number;
  /** The modifiers that were applied, echoed so the UI can explain the numbers. */
  modifiers: Required<RigModifiers>;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function bp(value: number, mult: number | undefined): number {
  const m = mult ?? BP_ONE;
  return Math.floor((value * m) / BP_ONE);
}

/**
 * Efficiency when a demand outruns the capacity that serves it.
 *
 * Straight ratio — cooling that covers 60% of the heat yields 60% output —
 * because a miner has to be able to read the gauge and know what one more
 * cooler buys them. Floored so the rig never stalls completely.
 */
function serviceRatio(capacity: number, demand: number, floor: number): number {
  if (demand <= 0) return 1;
  if (capacity >= demand) return 1;
  return clamp(capacity / demand, floor, 1);
}

/** Whether a part earns right now: not expired, not burned out. */
export function partIsLive(p: RigPart, now: Date): boolean {
  if (p.expiresAt.getTime() <= now.getTime()) return false;
  if (p.disabledUntil && p.disabledUntil.getTime() > now.getTime()) return false;
  return true;
}

/**
 * Read a rig's state: what it produces, what it costs to run, and how much
 * of that output survives the thermal and power penalties.
 *
 * Parts that have burned out are ignored, exactly as expired boosters were.
 */
export function rigTelemetry(params: {
  parts: RigPart[];
  chassis?: ChassisBonus;
  now?: Date;
  modifiers?: RigModifiers;
}): RigTelemetry {
  const now = params.now ?? new Date();
  const mods: Required<RigModifiers> = {
    heatMultBp: params.modifiers?.heatMultBp ?? BP_ONE,
    drawMultBp: params.modifiers?.drawMultBp ?? BP_ONE,
    hashMultBp: params.modifiers?.hashMultBp ?? BP_ONE,
    overclock: params.modifiers?.overclock ?? false,
    squadCooling: Math.max(0, params.modifiers?.squadCooling ?? 0),
    squadPower: Math.max(0, params.modifiers?.squadPower ?? 0),
    weatherHeatBp: params.modifiers?.weatherHeatBp ?? BP_ONE,
    collectiveHashBp: params.modifiers?.collectiveHashBp ?? 0,
  };

  const unexpired = params.parts.filter((p) => p.expiresAt.getTime() > now.getTime());
  const live = unexpired.filter((p) => partIsLive(p, now));

  let baseHashMilli = 0;
  let heatLoad = 0;
  let coolingCapacity = CHASSIS_COOLING + (params.chassis?.coolingBonus ?? 0) + mods.squadCooling;
  let powerDraw = 0;
  let powerSupply = CHASSIS_WATTS + (params.chassis?.powerBonus ?? 0) + mods.squadPower;
  let boostBp = 0;

  for (const p of live) {
    const isCore = p.kind === 'CORE';
    baseHashMilli += Math.max(0, p.hashMilli);
    // Overclock only heats the cores; the event multiplier heats everything.
    let heat = Math.max(0, p.heat);
    if (mods.overclock && isCore) heat = bp(heat, OVERCLOCK_HEAT_BP);
    heatLoad += bp(heat, mods.heatMultBp);
    coolingCapacity += Math.max(0, p.cooling);
    powerDraw += bp(Math.max(0, p.watts), mods.drawMultBp);
    powerSupply += Math.max(0, p.wattsSupplied);
    boostBp += Math.max(0, p.hashBoostBp);
  }

  // Modules multiply what the cores already make: a boost chip on a rig with
  // no cores is worth nothing, which is the intended trade.
  let hashMilli = Math.floor((baseHashMilli * (BP_ONE + boostBp)) / BP_ONE);
  if (mods.overclock) hashMilli = bp(hashMilli, OVERCLOCK_HASH_BP);
  hashMilli = bp(hashMilli, mods.hashMultBp);

  const thermalEfficiency = serviceRatio(coolingCapacity, heatLoad, THERMAL_FLOOR);
  const powerEfficiency = serviceRatio(powerSupply, powerDraw, POWER_FLOOR);

  return {
    hashMilli,
    baseHashMilli,
    heatLoad,
    coolingCapacity,
    powerDraw,
    powerSupply,
    thermalEfficiency,
    powerEfficiency,
    gridStability: Math.round(thermalEfficiency * powerEfficiency * 100),
    overheating: heatLoad > coolingCapacity,
    brownout: powerDraw > powerSupply,
    installedCount: live.length,
    disabledCount: unexpired.length - live.length,
    coolingSurplus: Math.max(0, coolingCapacity - mods.squadCooling - heatLoad),
    powerSurplus: Math.max(0, powerSupply - mods.squadPower - powerDraw),
    modifiers: mods,
  };
}

/**
 * Squad pooling.
 *
 * Each member's unused headroom goes into a pool; members over budget draw
 * from it in proportion to their deficit. A member never receives more than
 * their deficit, and the pool never lends more than it has, so a squad of
 * balanced rigs changes nothing and a squad cannot conjure capacity.
 */
export function poolHeadroom(
  members: { surplus: number; deficit: number }[],
): number[] {
  const pool = members.reduce((s, m) => s + Math.max(0, m.surplus), 0);
  const totalDeficit = members.reduce((s, m) => s + Math.max(0, m.deficit), 0);
  if (pool <= 0 || totalDeficit <= 0) return members.map(() => 0);
  const lend = Math.min(pool, totalDeficit);
  return members.map((m) => {
    const d = Math.max(0, m.deficit);
    if (d === 0) return 0;
    return Math.floor((lend * d) / totalDeficit);
  });
}

/**
 * One overclock hour elapsed: decide whether a part burns.
 *
 * `roll` is a 0–1 random supplied by the caller so the engine stays pure and
 * the service can be tested with a fixed value. Returns the index of the
 * part to burn, or null.
 */
export function overclockBurnRoll(params: {
  liveCount: number;
  roll: number;
  pick: number;
}): number | null {
  if (params.liveCount <= 0) return null;
  if (params.roll >= OVERCLOCK_BURN_CHANCE) return null;
  return clamp(Math.floor(params.pick * params.liveCount), 0, params.liveCount - 1);
}

/** Slots a miner has, clamped to the chassis ceiling. */
export function slotCount(granted?: number | null): number {
  const n = Math.trunc(granted ?? CHASSIS_SLOTS);
  return clamp(Number.isFinite(n) ? n : CHASSIS_SLOTS, 1, MAX_SLOTS);
}

/** Whether a slot index addresses a real slot on this rig. */
export function isValidSlot(index: number, slots: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < slots;
}
