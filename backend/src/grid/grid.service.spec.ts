import {
  GRID_EVENT_CATALOG,
  bpToPercent,
  pickNextCode,
  scheduleWindow,
  specFor,
  EVENT_MAX_H,
  EVENT_MIN_H,
  NEXT_EVENT_MAX_H,
  NEXT_EVENT_MIN_H,
} from './grid-events.catalog';
import { eventDto, rollUpMap } from './grid.service';

describe('grid events catalog', () => {
  it('converts basis points to signed percents', () => {
    expect(bpToPercent(13_000)).toBe(30);
    expect(bpToPercent(5_000)).toBe(-50);
    expect(bpToPercent(10_000)).toBe(0);
    expect(bpToPercent(7_000)).toBe(-30);
  });

  it('has the five events with the agreed multipliers', () => {
    expect(GRID_EVENT_CATALOG.map((s) => s.code)).toEqual([
      'HEATWAVE',
      'COLD_SNAP',
      'CHEAP_POWER',
      'GRID_STRAIN',
      'SOLAR_SURGE',
    ]);
    expect(specFor('HEATWAVE')?.heatMultBp).toBe(13_000);
    expect(specFor('COLD_SNAP')?.heatMultBp).toBe(7_000);
    expect(specFor('CHEAP_POWER')?.drawMultBp).toBe(5_000);
    expect(specFor('GRID_STRAIN')).toMatchObject({ drawMultBp: 14_000, hashMultBp: 11_000 });
    expect(specFor('SOLAR_SURGE')?.hashMultBp).toBe(15_000);
    expect(specFor('NOPE')).toBeUndefined();
  });

  it('never repeats the most recent code', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(pickNextCode('HEATWAVE')).not.toBe('HEATWAVE');
    }
    // Deterministic pick: rand=0 gives the first non-excluded entry.
    expect(pickNextCode('HEATWAVE', () => 0)).toBe('COLD_SNAP');
    expect(pickNextCode(null, () => 0)).toBe('HEATWAVE');
    expect(pickNextCode(null, () => 0.999)).toBe('SOLAR_SURGE');
  });

  it('schedules 36–72h out, lasting 4–8h', () => {
    const now = new Date('2026-09-12T00:00:00Z');
    const lo = scheduleWindow(now, () => 0);
    expect(lo.startsAt.getTime() - now.getTime()).toBe(NEXT_EVENT_MIN_H * 3_600_000);
    expect(lo.endsAt.getTime() - lo.startsAt.getTime()).toBe(EVENT_MIN_H * 3_600_000);

    const hi = scheduleWindow(now, () => 1);
    expect(hi.startsAt.getTime() - now.getTime()).toBe(NEXT_EVENT_MAX_H * 3_600_000);
    expect(hi.endsAt.getTime() - hi.startsAt.getTime()).toBe(EVENT_MAX_H * 3_600_000);
  });
});

describe('eventDto', () => {
  it('adds the percent fields', () => {
    const dto = eventDto({
      id: 'e1',
      code: 'GRID_STRAIN',
      title: 't',
      body: 'b',
      heatMultBp: 10_000,
      drawMultBp: 14_000,
      hashMultBp: 11_000,
      startsAt: new Date(0),
      endsAt: new Date(1),
    });
    expect(dto).toMatchObject({ heatPercent: 0, drawPercent: 40, hashPercent: 10 });
  });
});

describe('rollUpMap', () => {
  const at = new Date('2026-09-12T00:00:00Z');

  it('handles an empty grid', () => {
    expect(rollUpMap([], 0, at)).toEqual({
      totalRigs: 0,
      activeRigs: 0,
      stablePercent: 100,
      onlineNow: 0,
      countries: [],
      updatedAt: at,
    });
  });

  it('counts active and stable rigs per country and overall', () => {
    const map = rollUpMap(
      [
        { countryCode: 'IN', active: true, stable: true },
        { countryCode: 'IN', active: true, stable: false },
        { countryCode: 'IN', active: false, stable: true },
        { countryCode: 'KR', active: true, stable: true },
        { countryCode: null, active: true, stable: false },
      ],
      2,
      at,
    );
    expect(map.totalRigs).toBe(5);
    expect(map.activeRigs).toBe(4);
    // 2 of 4 active rigs stable.
    expect(map.stablePercent).toBe(50);
    expect(map.onlineNow).toBe(2);
    expect(map.countries).toEqual([
      { code: 'IN', miners: 3, active: 2, stablePercent: 50 },
      { code: 'KR', miners: 1, active: 1, stablePercent: 100 },
    ]);
  });

  it('sorts by active miners, then total, then code', () => {
    const map = rollUpMap(
      [
        { countryCode: 'ZA', active: false, stable: true },
        { countryCode: 'ZA', active: false, stable: true },
        { countryCode: 'AU', active: false, stable: true },
        { countryCode: 'BR', active: true, stable: true },
      ],
      0,
      at,
    );
    expect(map.countries.map((c) => c.code)).toEqual(['BR', 'ZA', 'AU']);
  });
});
