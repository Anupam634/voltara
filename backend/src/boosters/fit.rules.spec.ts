import {
  fitAll,
  toRigPart,
  FIX_HEADROOM_BP,
  MAX_FIX_PARTS,
  type CatalogPart,
} from './fit.rules';
import { BP_ONE, CHASSIS_SLOTS, type RigPart } from '../mining/rig.engine';

/**
 * The shop's numbers are what a miner pays money against, so what is pinned
 * here is that they describe the miner's OWN rig: that a core which cannot
 * be cooled reads as a downgrade, that a cooler on a hot rig reads as the
 * rate increase it really is, and that the suggested fix is the cheapest one
 * that actually works.
 */

const CATALOG: CatalogPart[] = [
  {
    code: 'VC1',
    name: 'VC-1 Volt Core',
    kind: 'CORE',
    priceUsd: 1,
    hashMilli: 2000,
    heat: 10,
    cooling: 0,
    watts: 45,
    wattsSupplied: 0,
    hashBoostBp: 0,
    durationDays: 30,
  },
  {
    code: 'VC10',
    name: 'VC-10 Surge Core',
    kind: 'CORE',
    priceUsd: 10,
    hashMilli: 20_000,
    heat: 48,
    cooling: 0,
    watts: 200,
    wattsSupplied: 0,
    hashBoostBp: 0,
    durationDays: 30,
  },
  {
    code: 'CX2',
    name: 'CX-2 Vapor Cooler',
    kind: 'COOLER',
    priceUsd: 2,
    hashMilli: 0,
    heat: 0,
    cooling: 40,
    watts: 18,
    wattsSupplied: 0,
    hashBoostBp: 0,
    durationDays: 30,
  },
  {
    code: 'CX6',
    name: 'CX-6 Loop Cooler',
    kind: 'COOLER',
    priceUsd: 6,
    hashMilli: 0,
    heat: 0,
    cooling: 120,
    watts: 40,
    wattsSupplied: 0,
    hashBoostBp: 0,
    durationDays: 30,
  },
  {
    code: 'PS3',
    name: 'PS-3 Feeder Unit',
    kind: 'PSU',
    priceUsd: 3,
    hashMilli: 0,
    heat: 6,
    cooling: 0,
    watts: 0,
    wattsSupplied: 220,
    hashBoostBp: 0,
    durationDays: 30,
  },
];

const NOW = new Date('2026-09-12T00:00:00Z');

function input(overrides: Partial<Parameters<typeof fitAll>[0]> = {}) {
  return {
    base: [] as RigPart[],
    chassis: {},
    modifiers: {},
    slots: CHASSIS_SLOTS,
    catalog: CATALOG,
    rate: { inviteCount: 0, rateAdjustMilli: 0, streakDays: 0 },
    now: NOW,
    ...overrides,
  };
}

const fitFor = (code: string, args = input()) =>
  fitAll(args).find((f) => f.code === code)!;

describe('toRigPart', () => {
  it('gives the simulated part a real lifetime so the engine counts it', () => {
    const part = toRigPart(CATALOG[0], NOW);
    expect(part.expiresAt.getTime()).toBe(NOW.getTime() + 30 * 86_400_000);
    expect(part.disabledUntil).toBeNull();
  });
});

describe('a bare chassis', () => {
  it('reads the entry core as clean — it is sized to run on nothing', () => {
    const fit = fitFor('VC1');
    expect(fit.clean).toBe(true);
    expect(fit.stabilityAfter).toBe(100);
    expect(fit.fix).toBeNull();
    // 0.9 base + 2.0 from the core.
    expect(fit.ratePerHourBefore).toBeCloseTo(0.9);
    expect(fit.ratePerHourAfter).toBeCloseTo(2.9);
  });

  it('refuses to call a core an upgrade when the chassis cannot cool it', () => {
    // This is the whole point: 48 heat against 12 chassis cooling.
    const fit = fitFor('VC10');
    expect(fit.clean).toBe(false);
    expect(fit.stabilityAfter).toBeLessThan(100);
    expect(fit.heatShort).toBeGreaterThan(0);
  });

  it('prices the working build, not just the part', () => {
    const { fix } = fitFor('VC10');
    expect(fix).not.toBeNull();
    expect(fix!.clean).toBe(true);
    expect(fix!.stability).toBe(100);
    // The part is $10; the fix is what it actually takes to run it.
    expect(fix!.totalUsd).toBe(10 + fix!.extraUsd);
    expect(fix!.ratePerHour).toBeGreaterThan(fitFor('VC10').ratePerHourAfter);
  });

  it('does not stop at a part that only helps — it keeps going until the rig runs', () => {
    // VC-10 breaks both budgets at once: 48 heat against 12 cooling, and
    // 200 W against 120. No single part fixes both, so a one-step suggestion
    // would quote a price that still leaves the rig throttled.
    const { fix } = fitFor('VC10');

    expect(fix!.clean).toBe(true);
    expect(fix!.steps.length).toBeGreaterThan(1);
    expect(fix!.steps.length).toBeLessThanOrEqual(MAX_FIX_PARTS);
    // Whatever it picks must not cost more than the obvious hand-worked
    // answer (CX-6 + PS-3 = $9), or the advice is worse than no advice.
    expect(fix!.extraUsd).toBeLessThanOrEqual(9);
  });
});

describe('thermal headroom', () => {
  it('does not recommend a build that sits exactly on its cooling limit', () => {
    // The catalogue's real VC-10 reaches a full 100% on heat 52 against
    // cooling 52 — nothing spare. Weather alone swings heat ±15%, so that
    // build drops below 100% the first warm afternoon, on a rig the shop
    // had just called clean.
    const { fix } = fitFor('VC10');
    const chosen = fix!.steps.map((s) => s.code);

    const stressed = fitAll(
      input({
        base: [
          toRigPart(CATALOG.find((c) => c.code === 'VC10')!, NOW),
          ...chosen.map((c) => toRigPart(CATALOG.find((p) => p.code === c)!, NOW)),
        ],
        modifiers: { heatMultBp: BP_ONE + FIX_HEADROOM_BP },
      }),
    )[0];

    expect(fix!.clean).toBe(true);
    // The recommended build still holds once the weather turns.
    expect(stressed.stabilityBefore).toBe(100);
  });

  it('still quotes the unstressed rate, not the pessimistic one', () => {
    // The margin picks the parts; it must not understate today's earnings.
    const { fix } = fitFor('VC10');
    expect(fix!.stability).toBe(100);
    expect(fix!.ratePerHour).toBeGreaterThan(fitFor('VC10').ratePerHourAfter);
  });
});

describe('a rig that is already overheating', () => {
  // One big core installed, nothing cooling it.
  const base: RigPart[] = [toRigPart(CATALOG[1], NOW)];

  it('shows a cooler as the rate increase it really is', () => {
    // The old shop said "+0/hr" here, because coolers make no hash. They
    // multiply everything instead, which is often the better buy.
    const fit = fitFor('CX6', input({ base }));

    expect(fit.ratePerHourAfter).toBeGreaterThan(fit.ratePerHourBefore);
    expect(fit.stabilityAfter).toBeGreaterThan(fit.stabilityBefore);
  });

  it('can rank cooling above another core', () => {
    const cooler = fitFor('CX6', input({ base }));
    const core = fitFor('VC1', input({ base }));

    expect(cooler.ratePerHourAfter).toBeGreaterThan(core.ratePerHourAfter);
  });
});

describe('slots', () => {
  it('marks a full rig as not fitting anything', () => {
    const base = Array.from({ length: CHASSIS_SLOTS }, () => toRigPart(CATALOG[0], NOW));
    const fit = fitFor('VC1', input({ base }));

    expect(fit.freeSlots).toBe(0);
    expect(fit.fits).toBe(false);
  });

  it('never suggests a fix that would not physically fit', () => {
    // Five of six slots used: the part takes the last one, so there is no
    // room left for anything that would fix it.
    const base = Array.from({ length: CHASSIS_SLOTS - 1 }, () => toRigPart(CATALOG[0], NOW));
    const fit = fitFor('VC10', input({ base }));

    expect(fit.fits).toBe(true);
    expect(fit.fix).toBeNull();
  });
});

describe('the rate shown is the rate earned', () => {
  it('carries the referral multiplier and the streak into the card', () => {
    const plain = fitFor('VC1');
    const boosted = fitFor(
      'VC1',
      input({ rate: { inviteCount: 25, rateAdjustMilli: 0, streakDays: 7 } }),
    );

    // Same part, same rig — a miner with invites and a streak earns more,
    // and the shop must not quote them the stock-chassis figure.
    expect(boosted.ratePerHourAfter).toBeGreaterThan(plain.ratePerHourAfter);
  });

  it('applies grid modifiers, so a heatwave changes the advice', () => {
    const calm = fitFor('VC1');
    const heatwave = fitFor(
      'VC1',
      input({ modifiers: { heatMultBp: BP_ONE * 2 } }),
    );

    expect(heatwave.stabilityAfter).toBeLessThanOrEqual(calm.stabilityAfter);
  });
});

describe('determinism', () => {
  it('gives the same rig the same advice twice', () => {
    const once = fitAll(input());
    const again = fitAll(input({ catalog: [...CATALOG].reverse() }));

    for (const fit of once) {
      const other = again.find((f) => f.code === fit.code)!;
      expect(other.fix?.steps.map((s) => s.code)).toEqual(fit.fix?.steps.map((s) => s.code));
    }
  });
});
