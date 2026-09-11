import { apiFetch, type RigOverview, type RigPartDto } from './api';

/* ───────────────────────── Grid events ───────────────────────── */

export type GridEventCode = 'HEATWAVE' | 'COLD_SNAP' | 'CHEAP_POWER' | 'GRID_STRAIN' | 'SOLAR_SURGE';

export interface GridEventDto {
  id: string;
  code: GridEventCode;
  title: string;
  body: string;
  heatMultBp: number;
  drawMultBp: number;
  hashMultBp: number;
  /** (bp − 10000) / 100, e.g. +30, −50. */
  heatPercent: number;
  drawPercent: number;
  hashPercent: number;
  startsAt: string;
  endsAt: string;
}

export interface GridEventFeed {
  active: GridEventDto | null;
  upcoming: GridEventDto | null;
  recent: GridEventDto[];
  serverTime: string;
}

export const getGridEvent = () => apiFetch<GridEventFeed>('/grid/event');

/* ────────────────────────── Live map ─────────────────────────── */

export interface GridMapCountry {
  code: string;
  miners: number;
  active: number;
  stablePercent: number;
}

export interface GridMapDto {
  totalRigs: number;
  activeRigs: number;
  stablePercent: number;
  onlineNow: number;
  countries: GridMapCountry[];
  updatedAt: string;
}

export const getGridMap = () => apiFetch<GridMapDto>('/grid/map');

/**
 * The counters under the landing hero.
 *
 * Measured, not seeded: the strip this feeds used to invent payouts and
 * wallet addresses on a timer. Public, so it loads before signup.
 */
export interface GridStatsDto {
  miners: number;
  activeRigs: number;
  onlineNow: number;
  countries: number;
  stablePercent: number;
  /** VOLTS credited by mining in the last 24h. */
  voltsMined24h: number;
  updatedAt: string;
}

export const getGridStats = () => apiFetch<GridStatsDto>('/grid/stats');

/* ───────────────── Overclock · salvage · craft ───────────────── */

export const setOverclock = (on: boolean) =>
  apiFetch<RigOverview>('/rig/overclock', { method: 'POST', body: JSON.stringify({ on }) });

export const salvagePart = (boosterId: string) =>
  apiFetch<{ scrap: number; salvagedId: string }>('/rig/salvage', {
    method: 'POST',
    body: JSON.stringify({ boosterId }),
  });

export const craftPart = () =>
  apiFetch<{ part: RigPartDto; scrap: number; slot: number | null }>('/rig/craft', { method: 'POST' });

/* ─────────────────────────── Skins ───────────────────────────── */

export interface SkinDto {
  id: string;
  name: string;
  priceVolts: number;
  description: string;
  accent: string;
  owned: boolean;
  equipped: boolean;
}

export interface SkinsDto {
  equipped: string;
  owned: string[];
  catalog: SkinDto[];
}

export const getSkins = () => apiFetch<SkinsDto>('/rig/skins');
export const buySkin = (skin: string) =>
  apiFetch<SkinsDto>('/rig/skins/buy', { method: 'POST', body: JSON.stringify({ skin }) });
export const equipSkin = (skin: string) =>
  apiFetch<SkinsDto>('/rig/skins/equip', { method: 'POST', body: JSON.stringify({ skin }) });

/* ──────────────── Real-world weather and the collective goal ─────────── */

export interface WeatherEntry {
  countryCode: string;
  city: string;
  tempC: number;
  /** Signed: +13 means coolers are working 13% harder today. */
  heatPercent: number;
}

export interface WeatherTableDto {
  countries: WeatherEntry[];
  updatedAt: string | null;
}

export const getGridWeather = () => apiFetch<WeatherTableDto>('/grid/weather');

export interface CollectiveDto {
  /** Share of active rigs sitting at 100% stability, 0-100. */
  stablePercent: number;
  /** The share needed to earn the bonus. */
  threshold: number;
  active: number;
  /** What every miner earns while the grid holds. Never negative. */
  bonusPercent: number;
  holding: boolean;
  pointsToGo: number;
  updatedAt: string;
}

export const getGridCollective = () => apiFetch<CollectiveDto>('/grid/collective');

/* ─────────────────── Payout terms (public) ──────────────────── */

/**
 * Whether the payout window is actually open.
 *
 * The landing quotes a conversion ratio and a 100-VOLTS minimum; on their
 * own those read as a working cash-out path, and payouts are gated until
 * $VLTR is on-chain (SPEC §4). This comes from the same `readPayoutWindow`
 * the withdraw screen uses, so the page starts saying "open" by itself the
 * moment it is — nothing to remember to change.
 */
export interface PayoutStatusDto {
  open: boolean;
  /** Announced opening instant, or null when no date has been set. */
  opensAt: string | null;
  minPoints: number;
  pointsPerToken: number;
}

export const getPayoutStatus = () => apiFetch<PayoutStatusDto>('/withdrawals/status');
