'use client';

/**
 * Player-to-player part market and the weekly blueprint challenge.
 *
 * Kept apart from lib/api.ts so the core client stays about the account,
 * the rig and mining; everything here is optional social surface.
 */

import { apiFetch, type RigPartDto, type RigPartKind } from './api';

// ─────────────────────────── Part market ──────────────────────

export type ListingStatus = 'ACTIVE' | 'SOLD' | 'CANCELLED';

export interface MarketUser {
  id: string;
  name: string;
}

export interface ListingDto {
  id: string;
  status: ListingStatus;
  priceVolts: number;
  createdAt: string;
  soldAt: string | null;
  seller: MarketUser;
  buyer: MarketUser | null;
  part: RigPartDto & { daysLeft: number };
  /** The caller is the seller. */
  mine: boolean;
}

/** Platform cut on every sale, in basis points (500 = 5%). */
export const MARKET_FEE_BP = 500;

export const getListings = (kind?: RigPartKind) =>
  apiFetch<{ listings: ListingDto[]; feeBp: number }>(
    `/market/parts${kind ? `?kind=${kind}` : ''}`,
  );

export const getMyListings = () =>
  apiFetch<{ selling: ListingDto[]; sold: ListingDto[]; bought: ListingDto[] }>(
    '/market/parts/mine',
  );

export const listPart = (boosterId: string, priceVolts: number) =>
  apiFetch<ListingDto>('/market/parts', {
    method: 'POST',
    body: JSON.stringify({ boosterId, priceVolts }),
  });

export const cancelListing = (id: string) =>
  apiFetch<{ ok: true } | ListingDto>(`/market/parts/${id}`, { method: 'DELETE' });

export const buyListing = (id: string) =>
  apiFetch<{ listing: ListingDto; slot: number | null }>(`/market/parts/${id}/buy`, {
    method: 'POST',
  });

// ───────────────────────── Weekly challenge ───────────────────

export interface ChallengeDto {
  id: string;
  weekKey: string;
  title: string;
  body: string;
  targetHashPerHour: number;
  startsAt: string;
  endsAt: string;
  submissions: number;
  /** Part codes awarded to 1st / 2nd / 3rd. */
  rewards: string[];
}

export interface CatalogPartDto {
  code: string;
  name: string;
  kind: RigPartKind;
  priceUsd: number;
  hashPerHour: number;
  heat: number;
  cooling: number;
  watts: number;
  wattsSupplied: number;
  hashBoostPercent: number;
  tier: number;
}

export interface SubmissionDto {
  id: string;
  rank: number;
  user: MarketUser;
  partCodes: string[];
  costUsd: number;
  hashPerHour: number;
  gridStability: number;
  createdAt: string;
  mine: boolean;
}

export interface ChallengeBoard {
  challenge: ChallengeDto;
  catalog: CatalogPartDto[];
  mine: SubmissionDto | null;
  top: SubmissionDto[];
  previous: { challenge: ChallengeDto; winners: SubmissionDto[] } | null;
}

export const getChallenge = () => apiFetch<ChallengeBoard>('/challenge');

export const submitBuild = (partCodes: string[]) =>
  apiFetch<{ mine: SubmissionDto; rank: number }>('/challenge/submit', {
    method: 'POST',
    body: JSON.stringify({ partCodes }),
  });

// ─────────────────────── Client-side rig maths ─────────────────
//
// Mirrors backend/src/mining/rig.engine.ts for a stock chassis with no
// modifiers, so the builder can show cost / hash / stability live without a
// round trip. The server recomputes on submit; this is preview only.

export const SIM_CHASSIS_COOLING = 12;
export const SIM_CHASSIS_WATTS = 120;
export const SIM_SLOTS = 6;
const THERMAL_FLOOR = 0.25;
const POWER_FLOOR = 0.1;

export interface SimReadout {
  costUsd: number;
  hashPerHour: number;
  baseHashPerHour: number;
  heatLoad: number;
  coolingCapacity: number;
  powerDraw: number;
  powerSupply: number;
  thermalEfficiency: number;
  powerEfficiency: number;
  gridStability: number;
  overheating: boolean;
  brownout: boolean;
}

function ratio(capacity: number, demand: number, floor: number): number {
  if (demand <= 0) return 1;
  if (capacity >= demand) return 1;
  return Math.min(1, Math.max(floor, capacity / demand));
}

export function simulateRig(parts: CatalogPartDto[]): SimReadout {
  let costUsd = 0;
  let baseHash = 0;
  let heat = 0;
  let cooling = SIM_CHASSIS_COOLING;
  let draw = 0;
  let supply = SIM_CHASSIS_WATTS;
  let boostPercent = 0;

  for (const p of parts) {
    costUsd += p.priceUsd;
    baseHash += Math.max(0, p.hashPerHour);
    heat += Math.max(0, p.heat);
    cooling += Math.max(0, p.cooling);
    draw += Math.max(0, p.watts);
    supply += Math.max(0, p.wattsSupplied);
    boostPercent += Math.max(0, p.hashBoostPercent);
  }

  // Modules are additive across each other and multiply total core hash.
  const hash = Math.floor(baseHash * 1000 * (1 + boostPercent / 100)) / 1000;
  const thermal = ratio(cooling, heat, THERMAL_FLOOR);
  const power = ratio(supply, draw, POWER_FLOOR);

  return {
    costUsd,
    hashPerHour: hash,
    baseHashPerHour: baseHash,
    heatLoad: heat,
    coolingCapacity: cooling,
    powerDraw: draw,
    powerSupply: supply,
    thermalEfficiency: thermal,
    powerEfficiency: power,
    gridStability: Math.round(thermal * power * 100),
    overheating: heat > cooling,
    brownout: draw > supply,
  };
}
