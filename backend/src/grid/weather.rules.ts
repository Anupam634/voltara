/**
 * Real-world heat.
 *
 * A miner's own country is actually warm or cold today, and their coolers
 * feel it. Nothing else in this category ties the game to where the player
 * physically is, and it gives every miner something local to talk about:
 * "42 °C in Delhi, my coolers are working 13% harder."
 *
 * Deliberately modest. The whole range is ±15% on heat — enough that a rig
 * sitting right on the edge of its cooling budget can tip over on a hot
 * afternoon, nowhere near enough to be a second economy. A miner who built
 * any headroom at all never notices it.
 *
 * Pure and side-effect free; `weather.service.ts` supplies the temperatures.
 */

import { BP_ONE } from '../mining/rig.engine';

/** Temperature at which coolers behave exactly as specified. */
export const WEATHER_NEUTRAL_C = 20;

/** Hottest and coldest temperatures the curve distinguishes. */
export const WEATHER_HOT_C = 45;
export const WEATHER_COLD_C = -10;

/** The most the weather can ever move heat, in basis points. 1500 = 15%. */
export const WEATHER_MAX_SWING_BP = 1_500;

export const WEATHER_MAX_BP = BP_ONE + WEATHER_MAX_SWING_BP; // 11_500
export const WEATHER_MIN_BP = BP_ONE - WEATHER_MAX_SWING_BP; //  8_500

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Heat multiplier for a temperature, in basis points.
 *
 * Two straight lines meeting at the neutral point, so the reading is easy to
 * explain and easy to predict: warmer than 20 °C costs you, colder helps,
 * and both ends flatten out rather than running away.
 *
 * A missing or nonsensical reading returns the identity — never a penalty.
 * The weather is flavour, and flavour must never punish a miner because a
 * third-party API was down.
 */
export function weatherHeatBp(tempC: number | null | undefined): number {
  if (tempC === null || tempC === undefined || !Number.isFinite(tempC)) {
    return BP_ONE;
  }
  const t = clamp(tempC, WEATHER_COLD_C, WEATHER_HOT_C);
  const delta = t - WEATHER_NEUTRAL_C;
  const slope =
    delta >= 0
      ? WEATHER_MAX_SWING_BP / (WEATHER_HOT_C - WEATHER_NEUTRAL_C)
      : WEATHER_MAX_SWING_BP / (WEATHER_NEUTRAL_C - WEATHER_COLD_C);
  return clamp(Math.round(BP_ONE + delta * slope), WEATHER_MIN_BP, WEATHER_MAX_BP);
}

/** The same figure as a signed percentage, for the UI. +13 means 13% hotter. */
export function weatherHeatPercent(tempC: number | null | undefined): number {
  return Math.round((weatherHeatBp(tempC) - BP_ONE) / 100);
}

/**
 * Capital-city coordinates, used only to ask Open-Meteo for a temperature.
 *
 * A country is one point on purpose: this is a mood, not a forecast, and a
 * per-miner location would mean collecting a location, which this app has no
 * reason to do. Countries missing from the table simply get no weather.
 */
export const CAPITAL_COORDS: Record<string, { lat: number; lon: number; city: string }> = {
  AE: { lat: 24.47, lon: 54.37, city: 'Abu Dhabi' },
  AR: { lat: -34.61, lon: -58.38, city: 'Buenos Aires' },
  AT: { lat: 48.21, lon: 16.37, city: 'Vienna' },
  AU: { lat: -35.28, lon: 149.13, city: 'Canberra' },
  BD: { lat: 23.81, lon: 90.41, city: 'Dhaka' },
  BE: { lat: 50.85, lon: 4.35, city: 'Brussels' },
  BR: { lat: -15.79, lon: -47.88, city: 'Brasilia' },
  CA: { lat: 45.42, lon: -75.7, city: 'Ottawa' },
  CH: { lat: 46.95, lon: 7.45, city: 'Bern' },
  CL: { lat: -33.45, lon: -70.67, city: 'Santiago' },
  CN: { lat: 39.9, lon: 116.41, city: 'Beijing' },
  CO: { lat: 4.71, lon: -74.07, city: 'Bogota' },
  CZ: { lat: 50.08, lon: 14.44, city: 'Prague' },
  DE: { lat: 52.52, lon: 13.41, city: 'Berlin' },
  DK: { lat: 55.68, lon: 12.57, city: 'Copenhagen' },
  EG: { lat: 30.04, lon: 31.24, city: 'Cairo' },
  ES: { lat: 40.42, lon: -3.7, city: 'Madrid' },
  ET: { lat: 9.01, lon: 38.76, city: 'Addis Ababa' },
  FI: { lat: 60.17, lon: 24.94, city: 'Helsinki' },
  FR: { lat: 48.85, lon: 2.35, city: 'Paris' },
  GB: { lat: 51.51, lon: -0.13, city: 'London' },
  GH: { lat: 5.6, lon: -0.19, city: 'Accra' },
  GR: { lat: 37.98, lon: 23.73, city: 'Athens' },
  HK: { lat: 22.32, lon: 114.17, city: 'Hong Kong' },
  HU: { lat: 47.5, lon: 19.04, city: 'Budapest' },
  ID: { lat: -6.21, lon: 106.85, city: 'Jakarta' },
  IE: { lat: 53.35, lon: -6.26, city: 'Dublin' },
  IL: { lat: 31.77, lon: 35.21, city: 'Jerusalem' },
  IN: { lat: 28.61, lon: 77.21, city: 'Delhi' },
  IQ: { lat: 33.31, lon: 44.37, city: 'Baghdad' },
  IR: { lat: 35.69, lon: 51.39, city: 'Tehran' },
  IT: { lat: 41.9, lon: 12.5, city: 'Rome' },
  JP: { lat: 35.69, lon: 139.69, city: 'Tokyo' },
  KE: { lat: -1.29, lon: 36.82, city: 'Nairobi' },
  KR: { lat: 37.57, lon: 126.98, city: 'Seoul' },
  KZ: { lat: 51.17, lon: 71.45, city: 'Astana' },
  LK: { lat: 6.93, lon: 79.86, city: 'Colombo' },
  MA: { lat: 34.02, lon: -6.84, city: 'Rabat' },
  MX: { lat: 19.43, lon: -99.13, city: 'Mexico City' },
  MY: { lat: 3.14, lon: 101.69, city: 'Kuala Lumpur' },
  NG: { lat: 9.06, lon: 7.49, city: 'Abuja' },
  NL: { lat: 52.37, lon: 4.9, city: 'Amsterdam' },
  NO: { lat: 59.91, lon: 10.75, city: 'Oslo' },
  NP: { lat: 27.72, lon: 85.32, city: 'Kathmandu' },
  NZ: { lat: -41.29, lon: 174.78, city: 'Wellington' },
  PE: { lat: -12.05, lon: -77.04, city: 'Lima' },
  PH: { lat: 14.6, lon: 120.98, city: 'Manila' },
  PK: { lat: 33.69, lon: 73.05, city: 'Islamabad' },
  PL: { lat: 52.23, lon: 21.01, city: 'Warsaw' },
  PT: { lat: 38.72, lon: -9.14, city: 'Lisbon' },
  RO: { lat: 44.43, lon: 26.1, city: 'Bucharest' },
  RS: { lat: 44.79, lon: 20.45, city: 'Belgrade' },
  RU: { lat: 55.75, lon: 37.62, city: 'Moscow' },
  SA: { lat: 24.71, lon: 46.68, city: 'Riyadh' },
  SE: { lat: 59.33, lon: 18.07, city: 'Stockholm' },
  SG: { lat: 1.35, lon: 103.82, city: 'Singapore' },
  TH: { lat: 13.76, lon: 100.5, city: 'Bangkok' },
  TR: { lat: 39.93, lon: 32.86, city: 'Ankara' },
  TW: { lat: 25.03, lon: 121.57, city: 'Taipei' },
  TZ: { lat: -6.79, lon: 39.21, city: 'Dar es Salaam' },
  UA: { lat: 50.45, lon: 30.52, city: 'Kyiv' },
  US: { lat: 38.91, lon: -77.04, city: 'Washington' },
  UZ: { lat: 41.3, lon: 69.24, city: 'Tashkent' },
  VN: { lat: 21.03, lon: 105.85, city: 'Hanoi' },
  ZA: { lat: -25.75, lon: 28.19, city: 'Pretoria' },
};

/** Whether the table can produce a reading for this country code. */
export function hasCoords(countryCode: string | null | undefined): boolean {
  return !!countryCode && countryCode.toUpperCase() in CAPITAL_COORDS;
}
