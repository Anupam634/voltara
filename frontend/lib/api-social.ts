'use client';

/**
 * Client for the social layer: rig duels and squads.
 *
 * Kept apart from lib/api.ts so the features can ship independently; the
 * shapes mirror the backend contract in src/duels and src/squads.
 */
import { apiFetch } from './api';

// ─────────────────────────── Duels ───────────────────────────

export type DuelStatus = 'OPEN' | 'ACTIVE' | 'SETTLED' | 'CANCELLED' | 'EXPIRED';

export interface DuelSide {
  id: string;
  name: string;
  ratePerHour: number;
  gridStability: number;
  countryCode: string | null;
}

export interface DuelDto {
  id: string;
  code: string;
  status: DuelStatus;
  stakeBp: number;
  stakePercent: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  challenger: DuelSide;
  opponent: DuelSide | null;
  winnerId: string | null;
  transferPoints: number | null;
  liveScore: { challenger: number; opponent: number };
  mine: 'challenger' | 'opponent' | null;
}

export interface MyDuels {
  open: DuelDto | null;
  active: DuelDto | null;
  history: DuelDto[];
}

export const createDuel = () => apiFetch<DuelDto>('/duels', { method: 'POST' });
export const getMyDuels = () => apiFetch<MyDuels>('/duels/mine');
export const getDuel = (code: string) => apiFetch<DuelDto>(`/duels/${encodeURIComponent(code)}`);
export const acceptDuel = (code: string) =>
  apiFetch<DuelDto>(`/duels/${encodeURIComponent(code)}/accept`, { method: 'POST' });
export const cancelDuel = (code: string) =>
  apiFetch<DuelDto>(`/duels/${encodeURIComponent(code)}/cancel`, { method: 'POST' });

// ─────────────────────────── Squads ──────────────────────────

export interface SquadMember {
  id: string;
  name: string;
  isOwner: boolean;
  joinedAt: string;
  ratePerHour: number;
  gridStability: number;
  coolingSurplus: number;
  powerSurplus: number;
  lent: { cooling: number; power: number };
}

export interface SquadDto {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  maxMembers: number;
  createdAt: string;
  members: SquadMember[];
  pool: { coolingSurplus: number; powerSurplus: number; coolingLent: number; powerLent: number };
  earnedPoints7d: number;
}

export interface SquadRankRow {
  id: string;
  name: string;
  members: number;
  earnedPoints: number;
  rank: number;
}

export const createSquad = (name: string) =>
  apiFetch<SquadDto>('/squads', { method: 'POST', body: JSON.stringify({ name }) });
export const joinSquad = (code: string) =>
  apiFetch<SquadDto>('/squads/join', { method: 'POST', body: JSON.stringify({ code }) });
export const leaveSquad = () => apiFetch<{ left: boolean }>('/squads/leave', { method: 'POST' });
export const getMySquad = () => apiFetch<{ squad: SquadDto | null }>('/squads/mine');
export const getSquadLeaderboard = () => apiFetch<{ squads: SquadRankRow[] }>('/squads/leaderboard');

// ─────────────────────────── Helpers ─────────────────────────

/** "5h 12m" / "12m" / "0m" until an ISO timestamp. */
export function untilLabel(iso: string | null): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '0m';
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

/** Return path stashed by the share landing before sending a visitor to sign up. */
export const RETURN_PATH_KEY = 'voltara_return_path';

/* ──────────────────────── Weekly season ──────────────────────── */

export interface SeasonStanding {
  rank: number;
  id: string;
  displayName: string;
  countryCode: string;
  /** VOLTS mined inside the season window. */
  earned: number;
  /** VOLTS the place pays — projected while the season is still running. */
  prize: number;
  isCurrentUser: boolean;
  watchCode: string | null;
}

export interface Season {
  weekKey: string;
  startsAt: string;
  endsAt: string;
  /** Null while the season is running. */
  closedAt: string | null;
  poolVolts: number;
  prizes: number[];
  places: number;
  standings: SeasonStanding[];
  me: {
    rank: number | null;
    earned: number;
    prize: number;
    totalRanked: number;
  };
}

export const getSeason = () =>
  apiFetch<{ current: Season; previous: Season | null }>('/season');
