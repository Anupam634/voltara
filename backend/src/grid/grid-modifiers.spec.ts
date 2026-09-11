import { BP_ONE } from '../mining/rig.engine';
import {
  CAPITAL_COORDS,
  WEATHER_COLD_C,
  WEATHER_HOT_C,
  WEATHER_MAX_BP,
  WEATHER_MIN_BP,
  WEATHER_NEUTRAL_C,
  hasCoords,
  weatherHeatBp,
  weatherHeatPercent,
} from './weather.rules';
import {
  COLLECTIVE_BONUS_BP,
  COLLECTIVE_THRESHOLD_PERCENT,
  collectiveBonusBp,
  collectiveHashMultBp,
  isHolding,
  pointsToThreshold,
} from './collective.rules';

describe('weatherHeatBp', () => {
  it('leaves heat alone at the neutral temperature', () => {
    expect(weatherHeatBp(WEATHER_NEUTRAL_C)).toBe(BP_ONE);
  });

  it('reaches exactly the cap at each end of the range', () => {
    expect(weatherHeatBp(WEATHER_HOT_C)).toBe(WEATHER_MAX_BP);
    expect(weatherHeatBp(WEATHER_COLD_C)).toBe(WEATHER_MIN_BP);
  });

  it('clamps beyond the range rather than running away', () => {
    expect(weatherHeatBp(60)).toBe(WEATHER_MAX_BP);
    expect(weatherHeatBp(-40)).toBe(WEATHER_MIN_BP);
  });

  it('makes hot weather cost and cold weather help', () => {
    expect(weatherHeatBp(35)).toBeGreaterThan(BP_ONE);
    expect(weatherHeatBp(5)).toBeLessThan(BP_ONE);
  });

  it('rises monotonically with temperature', () => {
    let previous = -Infinity;
    for (let t = -20; t <= 55; t += 1) {
      const bp = weatherHeatBp(t);
      expect(bp).toBeGreaterThanOrEqual(previous);
      previous = bp;
    }
  });

  it('never leaves the documented band', () => {
    for (let t = -60; t <= 80; t += 1) {
      const bp = weatherHeatBp(t);
      expect(bp).toBeGreaterThanOrEqual(WEATHER_MIN_BP);
      expect(bp).toBeLessThanOrEqual(WEATHER_MAX_BP);
    }
  });

  it('falls back to no effect when the reading is missing or broken', () => {
    // A third-party outage must never show up as a penalty on someone's rig.
    expect(weatherHeatBp(null)).toBe(BP_ONE);
    expect(weatherHeatBp(undefined)).toBe(BP_ONE);
    expect(weatherHeatBp(Number.NaN)).toBe(BP_ONE);
    expect(weatherHeatBp(Number.POSITIVE_INFINITY)).toBe(BP_ONE);
  });
});

describe('weatherHeatPercent', () => {
  it('reports the swing as a signed whole percentage', () => {
    expect(weatherHeatPercent(WEATHER_NEUTRAL_C)).toBe(0);
    expect(weatherHeatPercent(WEATHER_HOT_C)).toBe(15);
    expect(weatherHeatPercent(WEATHER_COLD_C)).toBe(-15);
  });
});

describe('CAPITAL_COORDS', () => {
  it('holds plausible coordinates for every entry', () => {
    for (const [code, c] of Object.entries(CAPITAL_COORDS)) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(c.lat).toBeGreaterThanOrEqual(-90);
      expect(c.lat).toBeLessThanOrEqual(90);
      expect(c.lon).toBeGreaterThanOrEqual(-180);
      expect(c.lon).toBeLessThanOrEqual(180);
      expect(c.city.length).toBeGreaterThan(1);
    }
  });

  it('recognises a known country and shrugs at an unknown one', () => {
    expect(hasCoords('IN')).toBe(true);
    expect(hasCoords('in')).toBe(true);
    expect(hasCoords('ZZ')).toBe(false);
    expect(hasCoords(null)).toBe(false);
  });
});

describe('collectiveBonusBp', () => {
  it('pays nothing below the threshold', () => {
    expect(collectiveBonusBp(COLLECTIVE_THRESHOLD_PERCENT - 1)).toBe(0);
    expect(collectiveBonusBp(0)).toBe(0);
  });

  it('pays the bonus at and above the threshold', () => {
    expect(collectiveBonusBp(COLLECTIVE_THRESHOLD_PERCENT)).toBe(COLLECTIVE_BONUS_BP);
    expect(collectiveBonusBp(100)).toBe(COLLECTIVE_BONUS_BP);
  });

  it('is never negative for any share, however bad the grid gets', () => {
    // The property that makes this collective mechanic fair: nobody else's
    // build can ever cost you anything.
    for (let share = -50; share <= 150; share += 1) {
      expect(collectiveBonusBp(share)).toBeGreaterThanOrEqual(0);
    }
  });

  it('falls back to no bonus on a missing or broken reading', () => {
    expect(collectiveBonusBp(null)).toBe(0);
    expect(collectiveBonusBp(undefined)).toBe(0);
    expect(collectiveBonusBp(Number.NaN)).toBe(0);
  });
});

describe('collectiveHashMultBp', () => {
  it('is the identity when the grid is not holding', () => {
    expect(collectiveHashMultBp(10)).toBe(BP_ONE);
  });

  it('adds the bonus when it is', () => {
    expect(collectiveHashMultBp(100)).toBe(BP_ONE + COLLECTIVE_BONUS_BP);
  });

  it('never drops below the identity', () => {
    for (let share = -50; share <= 150; share += 5) {
      expect(collectiveHashMultBp(share)).toBeGreaterThanOrEqual(BP_ONE);
    }
  });
});

describe('isHolding and pointsToThreshold', () => {
  it('agree with the bonus', () => {
    expect(isHolding(COLLECTIVE_THRESHOLD_PERCENT)).toBe(true);
    expect(isHolding(COLLECTIVE_THRESHOLD_PERCENT - 1)).toBe(false);
  });

  it('counts down the missing points and stops at zero', () => {
    expect(pointsToThreshold(COLLECTIVE_THRESHOLD_PERCENT - 12)).toBe(12);
    expect(pointsToThreshold(100)).toBe(0);
    expect(pointsToThreshold(null)).toBe(COLLECTIVE_THRESHOLD_PERCENT);
  });
});
