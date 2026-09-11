import {
  CRAFT_WEIGHTS,
  scrapForTier,
  weightedPick,
} from './salvage.service';

describe('scrapForTier', () => {
  it('pays one scrap for entry parts, two for mid, three for the top tier', () => {
    expect(scrapForTier(1)).toBe(1);
    expect(scrapForTier(2)).toBe(1);
    expect(scrapForTier(3)).toBe(2);
    expect(scrapForTier(4)).toBe(2);
    expect(scrapForTier(5)).toBe(3);
  });
});

describe('weightedPick', () => {
  const weights = [1, 2, 3, 4, 5].map((t) => CRAFT_WEIGHTS[t]);

  it('lands in the first bucket for a low roll and the last for a high one', () => {
    expect(weightedPick(weights, 0)).toBe(0);
    expect(weightedPick(weights, 0.999)).toBe(4);
  });

  it('splits the range in proportion to the weights', () => {
    // 50 / 100 → anything below 0.5 is tier 1, just above it is tier 2.
    expect(weightedPick(weights, 0.49)).toBe(0);
    expect(weightedPick(weights, 0.51)).toBe(1);
    // 50 + 28 = 78 → 0.78 crosses into tier 3.
    expect(weightedPick(weights, 0.79)).toBe(2);
  });

  it('clamps rolls outside 0–1 instead of throwing', () => {
    expect(weightedPick(weights, -1)).toBe(0);
    expect(weightedPick(weights, 2)).toBe(4);
  });

  it('falls back to the first option when every weight is zero', () => {
    expect(weightedPick([0, 0, 0], 0.5)).toBe(0);
  });
});
