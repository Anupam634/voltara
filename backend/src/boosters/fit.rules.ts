import {
  BP_ONE,
  ChassisBonus,
  composeBp,
  RigModifiers,
  RigPart,
  RigPartKind,
  RigTelemetry,
  rigTelemetry,
} from '../mining/rig.engine';
import { effectiveRateMilli } from '../mining/mining.engine';

/**
 * "What would this part actually do to *my* rig?"
 *
 * The shop used to answer that with `resultingRatePerHour` — the rate a part
 * gives on a *stock* chassis at ×1 referral. For anyone who already owns
 * parts that figure is simply wrong, and it is wrong in both directions:
 *
 *  - A big core reads as a pure upgrade when, on a rig with no spare cooling,
 *    it drops GRID STABILITY far enough to earn *less* than the cheaper core
 *    beside it.
 *  - A cooler reads as `+0/hr`, because coolers make no hash. On an
 *    overheating rig a cooler is often the single biggest rate increase on
 *    the page — stability multiplies everything, so buying cooling can beat
 *    buying a core. The old number could never say that.
 *
 * So every catalogue row is re-simulated against the caller's real rig with
 * the same engine the dashboard and the claim settle with, and where a part
 * creates a deficit a cheap working set that closes it is worked out too.
 * That second half is the honest version of an upsell: the rig genuinely
 * needs the cooler, and the price of the whole working build is shown
 * before anyone pays, not after.
 *
 * Pure and side-effect free — the service supplies the rig and the catalogue.
 */

const DAY_MS = 86_400_000;

/**
 * How many parts a suggested fix may add.
 *
 * A large core typically needs one cooler and one PSU; three leaves headroom
 * for the case where the cooler's own draw then needs covering. Beyond that
 * the suggestion stops being "here is what this costs to run" and starts
 * being a shopping list nobody asked for.
 */
export const MAX_FIX_PARTS = 3;

/**
 * Thermal headroom a suggested build must hold in reserve.
 *
 * A build can sit at exactly 100% and still be a bad recommendation: the
 * catalogue's own VC-10 reaches a full 100% on heat 52 against cooling 52,
 * with nothing spare. Real-world weather alone swings heat by up to ±15%
 * (`WEATHER_MAX_SWING_BP`), so that rig drops below 100% the first warm
 * afternoon in the miner's country — on a build the shop had just told them
 * would run clean. That is precisely the buyer's remorse this preview
 * exists to prevent.
 *
 * So a fix is only considered finished if it still holds at 100% with heat
 * raised by this much. Sized to the weather swing rather than to a HEATWAVE
 * event (+30%): the weather arrives unannounced and applies to everyone in a
 * hot country, whereas an event is announced on the grid and is meant to be
 * survivable only by rigs built with slack.
 *
 * The figures reported back are the *unstressed* ones — this margin decides
 * which parts to recommend, it does not change what the miner is told they
 * will earn.
 */
export const FIX_HEADROOM_BP = 1_500;

/** A catalogue row, in engine units. */
export interface CatalogPart {
  code: string;
  name: string;
  kind: RigPartKind;
  priceUsd: number;
  /** Hash contributed, milli-points/hour. */
  hashMilli: number;
  heat: number;
  cooling: number;
  watts: number;
  wattsSupplied: number;
  hashBoostBp: number;
  durationDays: number;
}

/** Everything outside the rig that scales the final rate. */
export interface RateInputs {
  inviteCount: number;
  rateAdjustMilli: number;
  streakDays: number;
}

export interface FitInput {
  /** Parts already installed. */
  base: RigPart[];
  chassis: ChassisBonus;
  modifiers: RigModifiers;
  /** The miner's slot count, including any granted beyond the chassis six. */
  slots: number;
  catalog: CatalogPart[];
  rate: RateInputs;
  now: Date;
}

export interface FixStep {
  code: string;
  name: string;
  priceUsd: number;
}

/** The cheapest way to make a part actually run on this rig. */
export interface PartFix {
  steps: FixStep[];
  /** Dollars on top of the part itself. */
  extraUsd: number;
  /** The part plus the fix. */
  totalUsd: number;
  stability: number;
  ratePerHour: number;
  /** Whether the fix truly reaches a clean 100%, or only improves things. */
  clean: boolean;
}

export interface PartFit {
  code: string;
  freeSlots: number;
  /** False when every slot is taken — nothing can be installed without freeing one. */
  fits: boolean;
  stabilityBefore: number;
  stabilityAfter: number;
  ratePerHourBefore: number;
  ratePerHourAfter: number;
  /** Thermal units the rig would be short. 0 when cooling covers the heat. */
  heatShort: number;
  /** Watts the rig would be short. 0 when supply covers the draw. */
  wattsShort: number;
  /** Runs at a full 100% with nothing else bought. */
  clean: boolean;
  fix: PartFix | null;
}

/** A catalogue row as the engine sees it. */
export function toRigPart(part: CatalogPart, now: Date): RigPart {
  return {
    kind: part.kind,
    hashMilli: part.hashMilli,
    heat: part.heat,
    cooling: part.cooling,
    watts: part.watts,
    wattsSupplied: part.wattsSupplied,
    hashBoostBp: part.hashBoostBp,
    expiresAt: new Date(now.getTime() + Math.max(1, part.durationDays) * DAY_MS),
    disabledUntil: null,
  };
}

/** Cheapest first; the code breaks ties so the same rig always gets the same advice. */
function byPrice(a: CatalogPart, b: CatalogPart): number {
  if (a.priceUsd !== b.priceUsd) return a.priceUsd - b.priceUsd;
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

/** Simulate every catalogue row against one rig. */
export function fitAll(input: FitInput): PartFit[] {
  const simWith = (modifiers: RigModifiers) => (extra: CatalogPart[]): RigTelemetry =>
    rigTelemetry({
      parts: [...input.base, ...extra.map((c) => toRigPart(c, input.now))],
      chassis: input.chassis,
      modifiers,
      now: input.now,
    });

  const sim = simWith(input.modifiers);
  // The same rig with a warm afternoon priced in — used only to choose the
  // parts a fix recommends, never to quote a figure.
  const simStressed = simWith({
    ...input.modifiers,
    heatMultBp: composeBp(input.modifiers.heatMultBp ?? BP_ONE, BP_ONE + FIX_HEADROOM_BP),
  });

  // The rate the miner actually earns, not raw rig hash: the referral
  // multiplier and the streak are what make the number on the card match
  // the number on their dashboard.
  const rateOf = (t: RigTelemetry): number =>
    effectiveRateMilli({
      rig: t,
      inviteCount: input.rate.inviteCount,
      rateAdjustMilli: input.rate.rateAdjustMilli,
      streakDays: input.rate.streakDays,
    }) / 1000;

  const before = sim([]);
  const stabilityBefore = before.gridStability;
  const ratePerHourBefore = rateOf(before);
  const freeSlots = Math.max(0, input.slots - input.base.length);

  return input.catalog.map((part) => {
    const after = sim([part]);
    return {
      code: part.code,
      freeSlots,
      fits: freeSlots > 0,
      stabilityBefore,
      stabilityAfter: after.gridStability,
      ratePerHourBefore,
      ratePerHourAfter: rateOf(after),
      heatShort: Math.max(0, after.heatLoad - after.coolingCapacity),
      wattsShort: Math.max(0, after.powerDraw - after.powerSupply),
      clean: after.gridStability === 100,
      fix:
        after.gridStability < 100
          ? planFix({
              sim,
              simStressed,
              rateOf,
              part,
              catalog: input.catalog,
              budget: Math.min(MAX_FIX_PARTS, freeSlots - 1),
            })
          : null,
    };
  });
}

/**
 * A cheap set of catalogue parts that brings a build back to 100%.
 *
 * Greedy, not optimal, and the distinction matters because this number has a
 * price on it. At each step it looks at what the rig is actually short of —
 * heat first, since an overheating rig is the more common failure — and
 * takes the cheapest part that finishes the job outright; only if nothing
 * finishes it does it settle for the part that buys the most stability.
 * That ordering keeps it honest in the common cases (it will not sell a
 * $6 cooler where a $2 one closes the gap) but it can still miss a cheaper
 * combination that needs looking two steps ahead. An exhaustive search over
 * a dozen parts is affordable if this ever needs to be exact; it is not
 * exact today, so nothing downstream should describe it as "the cheapest".
 *
 * Bounded by `MAX_FIX_PARTS` and by the slots actually free, and it returns
 * whatever it managed within that budget together with the stability it
 * really reaches — callers must not assume 100% (see `PartFix.clean`).
 */
function planFix(params: {
  sim: (extra: CatalogPart[]) => RigTelemetry;
  simStressed: (extra: CatalogPart[]) => RigTelemetry;
  rateOf: (t: RigTelemetry) => number;
  part: CatalogPart;
  catalog: CatalogPart[];
  budget: number;
}): PartFix | null {
  const { sim, simStressed, rateOf, part, catalog, budget } = params;
  if (budget <= 0) return null;

  const chosen: CatalogPart[] = [];
  // Progress is judged under stress, so the loop keeps buying until the build
  // holds on a warm day rather than stopping the moment it touches 100% on a
  // cool one.
  let current = simStressed([part]);

  while (current.gridStability < 100 && chosen.length < budget) {
    // Both deficits at once, not one at a time. A big core usually breaks the
    // thermal *and* the power budget, and an earlier version picked the
    // dimension with the larger shortfall and kept feeding it — buying cooler
    // after cooler while the rig stayed in brownout, never reaching 100% and
    // spending the whole budget getting there.
    const shortHeat = current.heatLoad > current.coolingCapacity;
    const shortPower = current.powerDraw > current.powerSupply;
    const candidates = catalog.filter(
      (c) => (shortHeat && c.cooling > 0) || (shortPower && c.wattsSupplied > 0),
    );

    let pick: CatalogPart | null = null;
    let picked: RigTelemetry | null = null;

    // Cheapest single addition that finishes the job with headroom intact.
    for (const candidate of [...candidates].sort(byPrice)) {
      const t = simStressed([part, ...chosen, candidate]);
      if (t.gridStability === 100) {
        pick = candidate;
        picked = t;
        break;
      }
    }

    // Otherwise whatever buys the most stability, cheapest on a tie.
    if (!pick) {
      for (const candidate of [...candidates].sort(byPrice)) {
        const t = simStressed([part, ...chosen, candidate]);
        if (t.gridStability <= current.gridStability) continue;
        if (!picked || t.gridStability > picked.gridStability) {
          pick = candidate;
          picked = t;
        }
      }
    }

    if (!pick || !picked) break;
    chosen.push(pick);
    current = picked;
  }

  if (chosen.length === 0) return null;

  // Report the real rig, not the stressed one: the margin picked the parts,
  // it must not understate what the miner will actually earn today.
  const actual = sim([part, ...chosen]);
  const extraUsd = chosen.reduce((sum, c) => sum + c.priceUsd, 0);
  return {
    steps: chosen.map((c) => ({ code: c.code, name: c.name, priceUsd: c.priceUsd })),
    extraUsd,
    totalUsd: extraUsd + part.priceUsd,
    stability: actual.gridStability,
    ratePerHour: rateOf(actual),
    clean: actual.gridStability === 100,
  };
}
