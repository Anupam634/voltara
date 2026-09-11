import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BP_ONE } from '../mining/rig.engine';
import { GridService } from './grid.service';
import {
  COLLECTIVE_BONUS_BP,
  COLLECTIVE_THRESHOLD_PERCENT,
  collectiveBonusBp,
  isHolding,
  pointsToThreshold,
} from './collective.rules';

/** How long a computed share stays usable between refreshes. */
const STATE_MAX_AGE_MS = 30 * 60_000;

export interface CollectiveState {
  stablePercent: number;
  threshold: number;
  active: number;
  bonusPercent: number;
  holding: boolean;
  pointsToGo: number;
  updatedAt: Date;
}

/**
 * The one number the whole platform shares: how much of the grid is holding
 * 100% stability, and the bonus everyone earns when enough of it is.
 *
 * The share comes from the map aggregate `GridService` already computes for
 * the landing page, so this adds a read of a cached value rather than a
 * second full scan of every rig.
 *
 * Like the weather, a miss is neutral: no state means no bonus, never a
 * penalty. That is the invariant that makes a collective mechanic safe to
 * ship — a miner can be indifferent to everyone else's builds and still
 * never be worse off.
 */
@Injectable()
export class CollectiveService {
  private readonly log = new Logger(CollectiveService.name);
  private state: CollectiveState | null = null;

  constructor(private readonly grid: GridService) {}

  /** Every ten minutes. The map underneath is itself cached for a minute. */
  @Cron('*/10 * * * *')
  async tick(): Promise<void> {
    await this.refresh().catch((err: unknown) => {
      this.log.warn(`Collective refresh failed: ${String(err)}`);
    });
  }

  /**
   * The hash multiplier every rig currently earns, in basis points.
   *
   * Synchronous: called on every status poll and claim settlement, so it
   * reads the last computed state and never touches the database.
   */
  hashMultBpNow(): number {
    return BP_ONE + this.bonusBpNow();
  }

  /** Just the bonus part, for attribution in the telemetry echo. */
  bonusBpNow(): number {
    const s = this.current();
    return s ? collectiveBonusBp(s.stablePercent) : 0;
  }

  /** The last computed state, or null when it is missing or stale. */
  current(): CollectiveState | null {
    if (!this.state) return null;
    if (Date.now() - this.state.updatedAt.getTime() > STATE_MAX_AGE_MS) return null;
    return this.state;
  }

  /**
   * GET /api/grid/collective.
   *
   * Computes on demand when nothing has been cached yet, so the first
   * visitor after a deploy sees a real number rather than an empty grid.
   */
  async board(): Promise<CollectiveState> {
    const cached = this.current();
    if (cached) return cached;
    try {
      return await this.refresh();
    } catch (err: unknown) {
      this.log.warn(`Collective board fell back to neutral: ${String(err)}`);
      return {
        stablePercent: 0,
        threshold: COLLECTIVE_THRESHOLD_PERCENT,
        active: 0,
        bonusPercent: 0,
        holding: false,
        pointsToGo: COLLECTIVE_THRESHOLD_PERCENT,
        updatedAt: new Date(),
      };
    }
  }

  /** Recompute from the map aggregate. */
  async refresh(): Promise<CollectiveState> {
    const map = await this.grid.map();
    const bonusBp = collectiveBonusBp(map.stablePercent);
    const state: CollectiveState = {
      stablePercent: map.stablePercent,
      threshold: COLLECTIVE_THRESHOLD_PERCENT,
      active: map.activeRigs,
      bonusPercent: Math.round(bonusBp / 100),
      holding: isHolding(map.stablePercent),
      pointsToGo: pointsToThreshold(map.stablePercent),
      updatedAt: new Date(),
    };
    this.state = state;
    if (state.holding) {
      this.log.debug(
        `Grid holding at ${state.stablePercent}% — +${COLLECTIVE_BONUS_BP / 100}% for everyone.`,
      );
    }
    return state;
  }
}
