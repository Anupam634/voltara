import {
  ageInDays,
  apprenticeEligibility,
  cutExpiresAt,
  cutIsLive,
  mentorCutMilli,
  mentorEligibility,
  APPRENTICE_MAX_AGE_DAYS,
  DEFAULT_MENTOR_CUT_BP,
  MAX_ACTIVE_APPRENTICES,
  MENTOR_CUT_DAYS,
  MENTOR_MIN_AGE_DAYS,
} from './apprentice.rules';

const DAY = 86_400_000;
const now = new Date('2026-09-15T12:00:00.000Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);

describe('ageInDays', () => {
  it('floors to whole days', () => {
    expect(ageInDays(new Date(now.getTime() - DAY * 2.9), now)).toBe(2);
  });

  it('never goes negative for a clock skewed into the future', () => {
    expect(ageInDays(new Date(now.getTime() + DAY), now)).toBe(0);
  });
});

describe('mentorEligibility', () => {
  const ok = {
    createdAt: daysAgo(30),
    gridStability: 100,
    activeApprentices: 0,
    hasMentor: false,
    now,
  };

  it('lets a settled miner with a stable rig mentor', () => {
    const e = mentorEligibility(ok);
    expect(e.canMentor).toBe(true);
    expect(e.reason).toBeNull();
    expect(e.capacity).toBe(MAX_ACTIVE_APPRENTICES);
  });

  it('refuses an account younger than the minimum and says how long to wait', () => {
    const e = mentorEligibility({ ...ok, createdAt: daysAgo(2) });
    expect(e.canMentor).toBe(false);
    expect(e.reason).toBe('TOO_NEW');
    expect(e.daysToWait).toBe(MENTOR_MIN_AGE_DAYS - 2);
  });

  it('admits an account exactly at the minimum age', () => {
    const e = mentorEligibility({ ...ok, createdAt: daysAgo(MENTOR_MIN_AGE_DAYS) });
    expect(e.canMentor).toBe(true);
    expect(e.daysToWait).toBe(0);
  });

  it('refuses a rig that is not holding full stability', () => {
    expect(mentorEligibility({ ...ok, gridStability: 99 }).reason).toBe('RIG_UNSTABLE');
  });

  it('refuses once the mentor is at capacity', () => {
    const e = mentorEligibility({ ...ok, activeApprentices: MAX_ACTIVE_APPRENTICES });
    expect(e.canMentor).toBe(false);
    expect(e.reason).toBe('AT_CAPACITY');
  });

  it('refuses a miner who is themselves an apprentice', () => {
    // Otherwise two fresh accounts could adopt each other and both draw a cut.
    expect(mentorEligibility({ ...ok, hasMentor: true }).reason).toBe('IS_APPRENTICE');
  });

  it('reports age before anything else, so the advice is actionable', () => {
    const e = mentorEligibility({
      ...ok,
      createdAt: daysAgo(1),
      gridStability: 40,
      activeApprentices: 9,
    });
    expect(e.reason).toBe('TOO_NEW');
  });
});

describe('apprenticeEligibility', () => {
  it('accepts a newcomer with no mentor', () => {
    const e = apprenticeEligibility({ createdAt: daysAgo(3), hasMentor: false, isSelf: false, now });
    expect(e.canBeAdopted).toBe(true);
    expect(e.reason).toBeNull();
  });

  it('refuses an account past the newcomer window', () => {
    const e = apprenticeEligibility({
      createdAt: daysAgo(APPRENTICE_MAX_AGE_DAYS),
      hasMentor: false,
      isSelf: false,
      now,
    });
    expect(e.reason).toBe('TOO_OLD');
  });

  it('refuses a miner who already has a mentor', () => {
    const e = apprenticeEligibility({ createdAt: daysAgo(1), hasMentor: true, isSelf: false, now });
    expect(e.reason).toBe('HAS_MENTOR');
  });

  it('refuses self-adoption', () => {
    const e = apprenticeEligibility({ createdAt: daysAgo(1), hasMentor: false, isSelf: true, now });
    expect(e.reason).toBe('IS_SELF');
  });
});

describe('cutIsLive', () => {
  it('is false for an offer that was never accepted', () => {
    expect(cutIsLive(null, now)).toBe(false);
  });

  it('runs for the full window and stops after it', () => {
    expect(cutIsLive(daysAgo(MENTOR_CUT_DAYS - 1), now)).toBe(true);
    expect(cutIsLive(daysAgo(MENTOR_CUT_DAYS), now)).toBe(false);
  });

  it('expires exactly one window after acceptance', () => {
    const accepted = daysAgo(1);
    expect(cutExpiresAt(accepted).getTime()).toBe(
      accepted.getTime() + MENTOR_CUT_DAYS * DAY,
    );
  });
});

describe('mentorCutMilli', () => {
  it('pays the default share of a live mentorship', () => {
    const cut = mentorCutMilli({ earnedMilli: 69_600, acceptedAt: daysAgo(3), now });
    expect(cut).toBe(Math.floor((69_600 * DEFAULT_MENTOR_CUT_BP) / 10_000));
  });

  it('pays nothing once the window has closed', () => {
    expect(
      mentorCutMilli({ earnedMilli: 69_600, acceptedAt: daysAgo(MENTOR_CUT_DAYS + 1), now }),
    ).toBe(0);
  });

  it('pays nothing on an offer that was never accepted', () => {
    expect(mentorCutMilli({ earnedMilli: 69_600, acceptedAt: null, now })).toBe(0);
  });

  it('never mints more than the configured share', () => {
    // The apprentice keeps everything they earned; the cut is minted on top,
    // so it must stay a small fraction no matter what is passed in.
    const earned = 100_000;
    const cut = mentorCutMilli({ earnedMilli: earned, mentorCutBp: 99_999, acceptedAt: daysAgo(1), now });
    expect(cut).toBeLessThanOrEqual(earned);
  });

  it('floors a share too small to split rather than rounding up', () => {
    expect(mentorCutMilli({ earnedMilli: 19, acceptedAt: daysAgo(1), now })).toBe(0);
  });

  it('is never negative', () => {
    expect(mentorCutMilli({ earnedMilli: -500, acceptedAt: daysAgo(1), now })).toBe(0);
    expect(mentorCutMilli({ earnedMilli: 1_000, mentorCutBp: -5, acceptedAt: daysAgo(1), now })).toBe(0);
  });
});
