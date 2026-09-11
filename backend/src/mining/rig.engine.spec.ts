import {
  rigTelemetry,
  slotCount,
  isValidSlot,
  CHASSIS_COOLING,
  CHASSIS_WATTS,
  CHASSIS_SLOTS,
  MAX_SLOTS,
  THERMAL_FLOOR,
  POWER_FLOOR,
  type RigPart,
} from './rig.engine';

const H = 3_600_000;
const future = new Date(Date.now() + 10 * 24 * H);
const past = new Date(Date.now() - H);

/** Build a part, defaulting everything a given kind does not use. */
function part(p: Partial<RigPart> & Pick<RigPart, 'kind'>): RigPart {
  return {
    hashMilli: 0,
    heat: 0,
    cooling: 0,
    watts: 0,
    wattsSupplied: 0,
    hashBoostBp: 0,
    expiresAt: future,
    ...p,
  };
}

/** The seeded catalogue, so the tests fail if a seeded number drifts. */
const VC1 = part({ kind: 'CORE', hashMilli: 2000, heat: 10, watts: 45 });
const VC5 = part({ kind: 'CORE', hashMilli: 10000, heat: 26, watts: 110 });
const VC50 = part({ kind: 'CORE', hashMilli: 90000, heat: 190, watts: 760 });
const CX2 = part({ kind: 'COOLER', cooling: 40, watts: 18 });
const CX20 = part({ kind: 'COOLER', cooling: 420, watts: 90 });
const PS3 = part({ kind: 'PSU', wattsSupplied: 260, heat: 4 });
const PS12 = part({ kind: 'PSU', wattsSupplied: 900, heat: 12 });
const OD8 = part({ kind: 'MODULE', hashBoostBp: 1500, heat: 14, watts: 30 });

describe('rigTelemetry — an empty chassis', () => {
  it('reports the free capacity and no load', () => {
    const t = rigTelemetry({ parts: [] });
    expect(t.hashMilli).toBe(0);
    expect(t.coolingCapacity).toBe(CHASSIS_COOLING);
    expect(t.powerSupply).toBe(CHASSIS_WATTS);
    expect(t.gridStability).toBe(100);
    expect(t.overheating).toBe(false);
    expect(t.brownout).toBe(false);
  });
});

describe('rigTelemetry — the first purchase', () => {
  it('runs a VC-1 at full stability on a stock chassis', () => {
    // The whole onboarding promise: buy the cheapest core, get exactly the
    // advertised rate with nothing else to buy. If this ever fails, the
    // catalogue has outgrown the free chassis and the entry part must change.
    const t = rigTelemetry({ parts: [VC1] });
    expect(t.heatLoad).toBeLessThanOrEqual(t.coolingCapacity);
    expect(t.powerDraw).toBeLessThanOrEqual(t.powerSupply);
    expect(t.gridStability).toBe(100);
    expect(t.hashMilli).toBe(2000);
  });
});

describe('rigTelemetry — thermal throttle', () => {
  it('cuts output to the share of heat the cooling covers', () => {
    // VC-5 alone: 26 heat against 12 chassis cooling.
    const t = rigTelemetry({ parts: [VC5] });
    expect(t.overheating).toBe(true);
    expect(t.thermalEfficiency).toBeCloseTo(12 / 26, 6);
    expect(t.gridStability).toBe(Math.round((12 / 26) * 100));
  });

  it('a cooler clears the throttle it was bought for', () => {
    const t = rigTelemetry({ parts: [VC5, CX2] });
    expect(t.heatLoad).toBe(26);
    expect(t.coolingCapacity).toBe(CHASSIS_COOLING + 40);
    expect(t.overheating).toBe(false);
    expect(t.thermalEfficiency).toBe(1);
  });

  it('never throttles below the thermal floor', () => {
    const furnace = part({ kind: 'CORE', hashMilli: 90000, heat: 100_000 });
    const t = rigTelemetry({ parts: [furnace] });
    expect(t.thermalEfficiency).toBe(THERMAL_FLOOR);
  });
});

describe('rigTelemetry — brownout', () => {
  it('cuts output to the share of the draw the supply covers', () => {
    // A cooler big enough to fix the heat can itself outrun the chassis.
    const t = rigTelemetry({ parts: [VC50, CX20] });
    expect(t.powerDraw).toBe(760 + 90);
    expect(t.powerSupply).toBe(CHASSIS_WATTS);
    expect(t.brownout).toBe(true);
    expect(t.powerEfficiency).toBeCloseTo(120 / 850, 6);
  });

  it('a PSU pays for the draw', () => {
    const t = rigTelemetry({ parts: [VC50, CX20, PS12] });
    expect(t.powerSupply).toBe(CHASSIS_WATTS + 900);
    expect(t.brownout).toBe(false);
    expect(t.powerEfficiency).toBe(1);
  });

  it('never throttles below the power floor', () => {
    const hog = part({ kind: 'CORE', hashMilli: 1000, watts: 1_000_000 });
    const t = rigTelemetry({ parts: [hog] });
    expect(t.powerEfficiency).toBe(POWER_FLOOR);
  });
});

describe('rigTelemetry — a complete build', () => {
  it('reaches 100% stability once heat and draw are both covered', () => {
    const t = rigTelemetry({ parts: [VC50, CX20, PS12] });
    // heat 190 + 12 (the PSU's own) = 202 against 12 + 420 = 432
    expect(t.heatLoad).toBe(202);
    expect(t.coolingCapacity).toBe(432);
    // draw 760 + 90 = 850 against 120 + 900 = 1020
    expect(t.powerDraw).toBe(850);
    expect(t.powerSupply).toBe(1020);
    expect(t.gridStability).toBe(100);
    expect(t.hashMilli).toBe(90000);
  });

  it('compounds both penalties into one stability figure', () => {
    // A VC-50 dropped on a bare chassis: 190 heat against 12 cooling and
    // 760 W against 120 W. The raw thermal ratio (6%) is below the floor, so
    // the throttle stops at 25% and the brownout ratio does the rest.
    const t = rigTelemetry({ parts: [VC50] });
    expect(t.thermalEfficiency).toBe(THERMAL_FLOOR);
    expect(t.powerEfficiency).toBeCloseTo(120 / 760, 6);
    expect(t.gridStability).toBe(Math.round(THERMAL_FLOOR * (120 / 760) * 100));
    expect(t.overheating).toBe(true);
    expect(t.brownout).toBe(true);
  });
});

describe('rigTelemetry — modules', () => {
  it('multiplies total core hash by the module boost', () => {
    const t = rigTelemetry({ parts: [VC1, VC5, OD8] });
    expect(t.baseHashMilli).toBe(12000);
    expect(t.hashMilli).toBe(13800); // +15%
  });

  it('is worth nothing on a rig with no cores', () => {
    const t = rigTelemetry({ parts: [OD8] });
    expect(t.hashMilli).toBe(0);
  });

  it('stacks two modules additively, not compounding', () => {
    const t = rigTelemetry({ parts: [VC5, OD8, OD8] });
    // 10000 × (1 + 0.15 + 0.15), not 10000 × 1.15²
    expect(t.hashMilli).toBe(13000);
  });
});

describe('rigTelemetry — burnout', () => {
  it('ignores a part that has expired, along with its costs', () => {
    const deadCore = { ...VC5, expiresAt: past };
    const t = rigTelemetry({ parts: [VC1, deadCore] });
    expect(t.hashMilli).toBe(2000);
    expect(t.heatLoad).toBe(10);
    expect(t.installedCount).toBe(1);
  });

  it('a cooler burning out re-throttles the cores it was cooling', () => {
    const deadCooler = { ...CX2, expiresAt: past };
    const t = rigTelemetry({ parts: [VC5, deadCooler] });
    expect(t.overheating).toBe(true);
    expect(t.thermalEfficiency).toBeCloseTo(12 / 26, 6);
  });
});

describe('rigTelemetry — chassis bonuses', () => {
  it('grandfathers a build that predates running costs', () => {
    // What the migration does for a miner who bought a VC-50 under the old
    // rules: widen the chassis by exactly what the part costs to run.
    const t = rigTelemetry({
      parts: [VC50],
      chassis: {
        coolingBonus: 190 - CHASSIS_COOLING,
        powerBonus: 760 - CHASSIS_WATTS,
      },
    });
    expect(t.gridStability).toBe(100);
  });
});

describe('slotCount / isValidSlot', () => {
  it('defaults to the stock chassis and clamps to the ceiling', () => {
    expect(slotCount(undefined)).toBe(CHASSIS_SLOTS);
    expect(slotCount(null)).toBe(CHASSIS_SLOTS);
    expect(slotCount(99)).toBe(MAX_SLOTS);
    expect(slotCount(0)).toBe(1);
  });

  it('only accepts an in-range integer slot', () => {
    expect(isValidSlot(0, 6)).toBe(true);
    expect(isValidSlot(5, 6)).toBe(true);
    expect(isValidSlot(6, 6)).toBe(false);
    expect(isValidSlot(-1, 6)).toBe(false);
    expect(isValidSlot(1.5, 6)).toBe(false);
  });
});
