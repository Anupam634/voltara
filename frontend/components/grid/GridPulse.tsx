'use client';

import { useEffect, useState } from 'react';
import { getGridCollective, type CollectiveDto } from '../../lib/api-grid';
import { Chip, Icon, Progress } from '../ui';
import { fill, useS } from './strings';

const POLL_MS = 60_000;

/**
 * The one number the whole platform shares.
 *
 * Deliberately a single line rather than a panel: it sits under the live map
 * on the landing page and inside the dashboard, and it has one job — say
 * whether the grid is holding, and what that is worth to the reader.
 *
 * It only ever reports a bonus. There is no arrangement of other people's
 * rigs that costs a miner anything, and the copy never implies otherwise.
 */
export function GridPulse({ className = '' }: { className?: string }) {
  const S = useS();
  const [data, setData] = useState<CollectiveDto | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => {
      getGridCollective()
        .then((d) => {
          if (!alive) return;
          setData(d);
          setFailed(false);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!data) {
    return (
      <p className={`text-xs text-ink-3 ${className}`}>{failed ? S.pulse.offline : S.pulse.loading}</p>
    );
  }

  const holding = data.holding;
  const values = {
    bonus: data.bonusPercent || 5,
    threshold: data.threshold,
    gap: data.pointsToGo,
  };

  return (
    <div
      className={`v-panel ${holding ? 'v-panel--charge' : ''} p-4 sm:p-5 ${className}`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${holding ? 'bg-charge/12 text-charge' : 'bg-brand/10 text-brand-hi'}`}>
            <Icon name={holding ? 'sparkle' : 'gauge'} size={16} />
          </span>
          <span>
            <span className="v-eyebrow block">{S.pulse.eyebrow}</span>
            <span className="block font-display text-sm font-bold text-ink">
              {holding ? S.pulse.holding : S.pulse.slipping}
            </span>
          </span>
        </div>
        {holding && (
          <Chip tone="charge" dot>
            {fill(S.pulse.bonusChip, values)}
          </Chip>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        {fill(holding ? S.pulse.holdingBody : S.pulse.slippingBody, values)}
      </p>

      <div className="mt-4">
        <Progress value={(data.stablePercent / Math.max(1, data.threshold)) * 100} charge={holding} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-ink-3">
          <span>
            <span className={`v-num font-bold ${holding ? 'text-charge' : 'text-ink-2'}`}>
              {data.stablePercent}%
            </span>{' '}
            {S.pulse.stableNow}
          </span>
          <span>
            <span className="v-num font-bold text-ink-2">{data.threshold}%</span> {S.pulse.target}
          </span>
          <span>
            <span className="v-num font-bold text-ink-2">{data.active.toLocaleString()}</span>{' '}
            {S.pulse.activeRigs}
          </span>
        </div>
      </div>
    </div>
  );
}
