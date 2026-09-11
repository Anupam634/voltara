import {
  effectiveRateMilli,
  referralTierFor,
  accrueMilli,
  canClaim,
  pointsToToken,
  BASE_RATE_MILLI,
  WELCOME_CLAIM_MILLI,
  STREAK_GRACE_HOURS,
  CLAIM_WINDOW_HOURS,
  streakBonusBp,
  nextStreakTier,
  nextStreakDays,
} from './mining.engine';

const H = 3_600_000;

describe('referralTierFor', () => {
  it('maps invite counts to the SPEC tiers', () => {
    expect(referralTierFor(0).multiplier).toBe(1);
    expect(referralTierFor(3).multiplier).toBe(3);
    expect(referralTierFor(6).multiplier).toBe(4);
    expect(referralTierFor(20).multiplier).toBe(5);
    expect(referralTierFor(30).multiplier).toBe(6);
    expect(referralTierFor(31).multiplier).toBe(8);
  });
  it('clamps above the top band to the highest tier', () => {
    expect(referralTierFor(99999).multiplier).toBe(8);
  });
});

describe('effectiveRateMilli', () => {
  /** A balanced rig readout: nothing is throttling. */
  const stable = (hashMilli: number) => ({
    hashMilli,
    thermalEfficiency: 1,
    powerEfficiency: 1,
  });

  it('is the base rate on a bare chassis with no referrals', () => {
    expect(effectiveRateMilli({ inviteCount: 0 })).toBe(BASE_RATE_MILLI);
    expect(effectiveRateMilli({ rig: stable(0), inviteCount: 0 })).toBe(
      BASE_RATE_MILLI,
    );
  });

  it('a single VC-1 core yields 2.9/hr (matches the client spec)', () => {
    expect(effectiveRateMilli({ rig: stable(2000), inviteCount: 0 })).toBe(2900);
  });

  it('adds rig hash to base, then applies the referral multiplier', () => {
    // (900 + 2000 + 2000) × 3 = 14700
    expect(effectiveRateMilli({ rig: stable(4000), inviteCount: 3 })).toBe(14700);
  });

  it('throttles the whole output when the rig overheats', () => {
    const rate = effectiveRateMilli({
      rig: { hashMilli: 4000, thermalEfficiency: 0.5, powerEfficiency: 1 },
      inviteCount: 0,
    });
    // floor((900 + 4000) × 0.5) = 2450
    expect(rate).toBe(2450);
  });

  it('compounds a thermal throttle with a brownout', () => {
    const rate = effectiveRateMilli({
      rig: { hashMilli: 4000, thermalEfficiency: 0.5, powerEfficiency: 0.5 },
      inviteCount: 2, // ×3
    });
    // floor(4900 × 0.25) = 1225, × 3 = 3675
    expect(rate).toBe(3675);
  });

  it('applies the penalties before the referral multiplier, not after', () => {
    // Multiplying last keeps the two orderings apart: 4900 × 0.5 = 2450 × 3.
    const throttled = effectiveRateMilli({
      rig: { hashMilli: 4000, thermalEfficiency: 0.5, powerEfficiency: 1 },
      inviteCount: 3,
    });
    expect(throttled).toBe(7350);
  });

  it('an admin throttle floors the rate at zero rather than going negative', () => {
    const rate = effectiveRateMilli({
      rig: stable(2000),
      inviteCount: 3,
      rateAdjustMilli: -99999,
    });
    expect(rate).toBe(0);
  });
});

describe('accrueMilli', () => {
  it('caps the first-ever tap at the welcome amount', () => {
    // A brand-new account can tap the instant it exists, so the first tap
    // is a taste rather than a free day — the full window is what waits 24h
    // later. See WELCOME_CLAIM_MILLI.
    expect(accrueMilli({ rateMilli: 900, lastMineAt: null })).toBe(
      WELCOME_CLAIM_MILLI,
    );
  });

  it('never pays more than the miner actually earned on the first tap', () => {
    // A rate so low that a whole window is worth less than the welcome cap
    // must not be topped up to it.
    expect(accrueMilli({ rateMilli: 10, lastMineAt: null })).toBe(10 * 24);
  });

  it('lets the welcome cap be overridden', () => {
    expect(
      accrueMilli({ rateMilli: 900, lastMineAt: null, welcomeCapMilli: 1_000 }),
    ).toBe(1_000);
  });

  it('caps accrual at the 24h window', () => {
    const lastMineAt = new Date(Date.now() - 50 * H); // 50h ago
    expect(accrueMilli({ rateMilli: 900, lastMineAt })).toBe(900 * 24);
  });

  it('accrues proportionally within the window', () => {
    const lastMineAt = new Date(Date.now() - 5 * H);
    expect(accrueMilli({ rateMilli: 900, lastMineAt })).toBe(900 * 5);
  });
});

describe('canClaim', () => {
  it('allows the first claim', () => {
    expect(canClaim({ lastMineAt: null })).toBe(true);
  });
  it('blocks before cooldown, allows after', () => {
    expect(canClaim({ lastMineAt: new Date(Date.now() - 23 * H) })).toBe(false);
    expect(canClaim({ lastMineAt: new Date(Date.now() - 25 * H) })).toBe(true);
  });
});

describe('pointsToToken', () => {
  it('converts at 3 points = 1 token', () => {
    expect(pointsToToken(300_000)).toBe(100); // 300 points -> 100 token
  });
});

describe('streakBonusBp', () => {
  it('pays nothing below the first tier', () => {
    expect(streakBonusBp(0)).toBe(0);
    expect(streakBonusBp(2)).toBe(0);
  });

  it('climbs the SPEC tiers', () => {
    expect(streakBonusBp(3)).toBe(300);
    expect(streakBonusBp(7)).toBe(700);
    expect(streakBonusBp(14)).toBe(1_000);
    expect(streakBonusBp(30)).toBe(1_500);
  });

  it('clamps above the top tier rather than growing forever', () => {
    expect(streakBonusBp(365)).toBe(1_500);
  });
});

describe('nextStreakTier', () => {
  it('names the tier a miner is climbing towards', () => {
    expect(nextStreakTier(0)?.minDays).toBe(3);
    expect(nextStreakTier(3)?.minDays).toBe(7);
    expect(nextStreakTier(14)?.minDays).toBe(30);
  });

  it('returns null at the top', () => {
    expect(nextStreakTier(30)).toBeNull();
  });
});

describe('nextStreakDays', () => {
  const now = new Date();

  it('starts a streak on the first ever tap', () => {
    expect(nextStreakDays({ streakDays: 0, lastMineAt: null, now })).toBe(1);
  });

  it('extends a streak claimed inside the grace window', () => {
    const lastMineAt = new Date(now.getTime() - (CLAIM_WINDOW_HOURS + 5) * H);
    expect(nextStreakDays({ streakDays: 4, lastMineAt, now })).toBe(5);
  });

  it('extends right up to the edge of the grace window', () => {
    const edge = CLAIM_WINDOW_HOURS + STREAK_GRACE_HOURS;
    const lastMineAt = new Date(now.getTime() - edge * H + 1_000);
    expect(nextStreakDays({ streakDays: 9, lastMineAt, now })).toBe(10);
  });

  it('resets once the grace window has passed', () => {
    const late = CLAIM_WINDOW_HOURS + STREAK_GRACE_HOURS + 1;
    const lastMineAt = new Date(now.getTime() - late * H);
    expect(nextStreakDays({ streakDays: 12, lastMineAt, now })).toBe(1);
  });
});

describe('effectiveRateMilli with a streak', () => {
  it('leaves the rate alone below the first tier', () => {
    const base = effectiveRateMilli({ inviteCount: 0 });
    expect(effectiveRateMilli({ inviteCount: 0, streakDays: 2 })).toBe(base);
  });

  it('applies the streak bonus before the referral multiplier', () => {
    // 900 base x 1.07 = 963, then x3 for the tier-2 referral multiplier.
    expect(effectiveRateMilli({ inviteCount: 3, streakDays: 7 })).toBe(963 * 3);
  });

  it('stacks with the rig without compounding into the referral tier twice', () => {
    const rig = { hashMilli: 2_000, thermalEfficiency: 1, powerEfficiency: 1 };
    const plain = effectiveRateMilli({ rig, inviteCount: 0 });
    const streaked = effectiveRateMilli({ rig, inviteCount: 0, streakDays: 30 });
    expect(plain).toBe(BASE_RATE_MILLI + 2_000);
    // Basis points, not floats: 2900 x 11500 / 10000 lands on 3335, where
    // `plain * 1.15` would drift to 3334.999… and floor to 3334.
    expect(streaked).toBe(Math.floor((plain * 11_500) / 10_000));
  });
});
