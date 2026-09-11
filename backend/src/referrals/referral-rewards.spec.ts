import {
  REFERRAL_REWARD_TIERS,
  nextRewardTier,
  pendingRewards,
  rewardsFor,
  tierFromMeta,
} from './referral-rewards';

describe('REFERRAL_REWARD_TIERS', () => {
  it('is ordered by threshold, ascending', () => {
    const thresholds = REFERRAL_REWARD_TIERS.map((t) => t.invites);
    expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
  });

  it('uses the threshold as the tier id, so a row can never be renumbered', () => {
    for (const t of REFERRAL_REWARD_TIERS) {
      expect(t.tier).toBe(t.invites);
    }
  });

  it('carries the fields its kind needs', () => {
    for (const t of REFERRAL_REWARD_TIERS) {
      if (t.kind === 'PART') {
        expect(t.partCode).toBeTruthy();
        expect(t.durationDays).toBeGreaterThan(0);
      }
      if (t.kind === 'LOANER_EXTENSION') expect(t.extendHours).toBeGreaterThan(0);
      if (t.kind === 'SLOT') expect(t.slots).toBeGreaterThan(6);
    }
  });

  it('never pays points, so invites cannot be farmed for a withdrawal', () => {
    const kinds = new Set(REFERRAL_REWARD_TIERS.map((t) => t.kind));
    expect(kinds.has('PART' as never)).toBe(true);
    for (const t of REFERRAL_REWARD_TIERS) {
      expect(t).not.toHaveProperty('points');
      expect(t).not.toHaveProperty('milli');
    }
  });

  it('matches the SPEC ladder', () => {
    expect(REFERRAL_REWARD_TIERS.map((t) => [t.invites, t.reward])).toEqual([
      [1, 'LOANER_24H'],
      [3, 'CX2'],
      [5, 'PS3'],
      [10, 'SLOT_7'],
      [25, 'GRID_OPERATOR'],
    ]);
  });
});

describe('rewardsFor', () => {
  it('pays nothing before the first rung', () => {
    expect(rewardsFor(0)).toEqual([]);
  });

  it('includes every rung reached, not just the latest', () => {
    expect(rewardsFor(5).map((t) => t.reward)).toEqual([
      'LOANER_24H',
      'CX2',
      'PS3',
    ]);
  });

  it('unlocks exactly on the threshold', () => {
    expect(rewardsFor(2).map((t) => t.tier)).toEqual([1]);
    expect(rewardsFor(3).map((t) => t.tier)).toEqual([1, 3]);
  });

  it('clamps nonsense input rather than throwing', () => {
    expect(rewardsFor(-4)).toEqual([]);
    expect(rewardsFor(2.9).map((t) => t.tier)).toEqual([1]);
  });

  it('stops at the top of the ladder', () => {
    expect(rewardsFor(10_000)).toHaveLength(REFERRAL_REWARD_TIERS.length);
  });
});

describe('nextRewardTier', () => {
  it('names the rung being climbed', () => {
    expect(nextRewardTier(0)?.invites).toBe(1);
    expect(nextRewardTier(1)?.invites).toBe(3);
    expect(nextRewardTier(9)?.invites).toBe(10);
  });

  it('returns null once the ladder is finished', () => {
    expect(nextRewardTier(25)).toBeNull();
    expect(nextRewardTier(400)).toBeNull();
  });
});

describe('pendingRewards', () => {
  it('owes every unlocked tier when nothing has been granted', () => {
    expect(pendingRewards(5, []).map((t) => t.tier)).toEqual([1, 3, 5]);
  });

  it('skips tiers already in the ledger', () => {
    expect(pendingRewards(5, [1, 3]).map((t) => t.tier)).toEqual([5]);
  });

  it('owes nothing when the ledger is already caught up', () => {
    expect(pendingRewards(5, [1, 3, 5])).toEqual([]);
  });

  it('ignores granted tiers the miner has not actually reached', () => {
    // A tier granted by hand, or left over from a wider ladder. It must not
    // make an unreached tier look owed, nor crash the diff.
    expect(pendingRewards(3, [1, 10]).map((t) => t.tier)).toEqual([3]);
  });
});

describe('tierFromMeta', () => {
  it('reads the tier off a reward row', () => {
    expect(tierFromMeta({ tier: 3, reward: 'CX2' })).toBe(3);
  });

  it('returns null for anything that is not a reward row', () => {
    expect(tierFromMeta(null)).toBeNull();
    expect(tierFromMeta(undefined)).toBeNull();
    expect(tierFromMeta('CX2')).toBeNull();
    expect(tierFromMeta({})).toBeNull();
    expect(tierFromMeta({ tier: '3' })).toBeNull();
    expect(tierFromMeta({ tier: 3.5 })).toBeNull();
  });
});
