'use client';

/**
 * The daily rig puzzle.
 *
 * Its own module rather than a corner of api-market.ts: the puzzle pays
 * nothing and owns no economy, so it has no business sitting next to the
 * part market's money paths.
 */

import { apiFetch } from './api';
import { type CatalogPartDto, simulateRig, SIM_SLOTS, type SimReadout } from './api-market';

export { simulateRig, SIM_SLOTS };
export type { CatalogPartDto, SimReadout };

export interface DailyPuzzleDto {
  dayKey: string;
  /** 1-based, so the share line reads "#214". */
  number: number;
  budgetUsd: number;
  targetHashPerHour: number;
  startsAt: string;
  endsAt: string;
}

export interface DailySubmissionDto {
  id: string;
  rank: number;
  user: { id: string; name: string };
  partCodes: string[];
  costUsd: number;
  hashPerHour: number;
  gridStability: number;
  attempts: number;
  solvedAt: string;
  /** The two-line block, built server-side so every client agrees. */
  shareText: string;
  mine: boolean;
}

export interface DailyBoard {
  puzzle: DailyPuzzleDto;
  catalog: CatalogPartDto[];
  mine: DailySubmissionDto | null;
  solvedCount: number;
  distribution: { cost: number; count: number }[];
  top: DailySubmissionDto[];
  yesterday: { dayKey: string; number: number; best: DailySubmissionDto[] } | null;
}

export interface DailySubmitResult {
  mine: DailySubmissionDto;
  rank: number;
  beatPercent: number;
  shareText: string;
}

export const getDaily = () => apiFetch<DailyBoard>('/daily');

export const submitDaily = (partCodes: string[]) =>
  apiFetch<DailySubmitResult>('/daily/submit', {
    method: 'POST',
    body: JSON.stringify({ partCodes }),
  });
