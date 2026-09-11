'use client';

import { useEffect, useState } from 'react';
import type { RigOverview } from '../../lib/api';
import { Button, Chip, Eyebrow, Icon, Panel } from '../ui';
import { useS } from './strings';

function fmt(n: number, digits = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function remaining(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return '0m';
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  return hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`;
}

/**
 * The risk button.
 *
 * Shows both sides of the trade before the miner commits: the rate and the
 * stability with the overclock off and on, straight from the server, so the
 * panel never has to guess what the extra heat will cost.
 */
export function OverclockPanel({
  overclock,
  hasCore,
  busy,
  onToggle,
  className = '',
}: {
  overclock: NonNullable<RigOverview['overclock']>;
  hasCore: boolean;
  busy: boolean;
  onToggle: (on: boolean) => void;
  className?: string;
}) {
  const S = useS();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!overclock.active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [overclock.active]);

  const on = overclock.active;
  const gain = overclock.rateOn - overclock.rateOff;
  const worthIt = gain > 0.005;

  return (
    <Panel hud tone={on ? 'heat' : 'default'} className={`v-scanlines relative overflow-hidden p-5 ${className}`} as="section">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow tone={on ? 'default' : 'charge'} className={on ? 'text-heat' : ''}>
            <Icon name="flame" size={11} className="mr-1.5 inline-block" />
            {S.overclock.eyebrow}
          </Eyebrow>
          <h2 className="mt-1 font-display text-lg font-bold text-ink">{on ? S.overclock.on : S.overclock.title}</h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-2">{S.overclock.body}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="charge">
            <span className="v-num">+{overclock.hashBoostPercent}%</span> {S.overclock.hashTrade}
          </Chip>
          <Chip tone="heat">
            <span className="v-num">+{overclock.heatPercent}%</span> {S.overclock.heatTrade}
          </Chip>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Trade
          label={S.overclock.rate}
          off={`${fmt(overclock.rateOff)}`}
          on={`${fmt(overclock.rateOn)}`}
          unit="/h"
          good={worthIt}
          active={on}
        />
        <Trade
          label={S.overclock.stability}
          off={`${overclock.stabilityOff}%`}
          on={`${overclock.stabilityOn}%`}
          unit=""
          good={overclock.stabilityOn >= overclock.stabilityOff}
          active={on}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-[11px] leading-relaxed">
          <p className={worthIt ? 'font-bold text-charge' : 'font-bold text-warn'}>
            {worthIt ? S.overclock.worthIt : S.overclock.notWorthIt}
          </p>
          <p className="text-ink-3">{S.overclock.burnRisk}</p>
        </div>
        <div className="flex items-center gap-3">
          {on && overclock.until && (
            <span className="v-inset px-3 py-1.5 text-right">
              <span className="v-eyebrow block">{S.overclock.endsIn}</span>
              <span className="v-num text-sm font-extrabold text-heat">{remaining(overclock.until, now)}</span>
            </span>
          )}
          <Button
            variant={on ? 'danger' : hasCore ? 'charge' : 'ghost'}
            size="md"
            disabled={busy || (!on && !hasCore)}
            loading={busy}
            onClick={() => onToggle(!on)}
          >
            <Icon name={on ? 'x' : 'bolt'} size={14} />
            {on ? S.overclock.disengage : hasCore ? S.overclock.engage : S.overclock.needsCore}
          </Button>
        </div>
      </div>
      {on && <div className="v-trace mt-4 opacity-80" />}
    </Panel>
  );
}

function Trade({
  label,
  off,
  on,
  unit,
  good,
  active,
}: {
  label: string;
  off: string;
  on: string;
  unit: string;
  good: boolean;
  active: boolean;
}) {
  return (
    <div className="v-inset flex items-center justify-between gap-3 p-3">
      <span className="v-eyebrow">{label}</span>
      <span className="flex items-center gap-2 font-mono text-sm font-extrabold">
        <span className={active ? 'text-ink-3 line-through' : 'text-ink'}>
          {off}
          {unit}
        </span>
        <Icon name="chevron-right" size={12} className="text-ink-3" />
        <span className={good ? 'text-charge' : 'text-heat'}>
          {on}
          {unit}
        </span>
      </span>
    </div>
  );
}
