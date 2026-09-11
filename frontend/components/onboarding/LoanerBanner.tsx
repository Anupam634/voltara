'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getRig, type RigPartDto } from '../../lib/api';
import { Chip, Eyebrow, Icon, Panel } from '../ui';
import { fill, useOnboarding } from './strings';

/** Under this many hours left, the banner stops being an FYI and starts selling. */
const URGENT_HOURS = 12;
const POLL_MS = 60_000;

/** The free starter core, if one is still running. */
function findLoaner(parts: RigPartDto[]): RigPartDto | null {
  const now = Date.now();
  return (
    parts.find(
      (p) => p.source === 'LOANER' && new Date(p.expiresAt).getTime() > now,
    ) ?? null
  );
}

/** "2d 4h" / "11h 38m" / "6m". */
function remaining(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return '0m';
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

/**
 * The free 72h core, counting down.
 *
 * `parts` lets a page that already loaded the rig hand its data over
 * instead of paying for a second request; the dashboard omits it and the
 * banner fetches for itself. Renders nothing when there is no loaner, so it
 * is safe to mount unconditionally.
 */
export function LoanerBanner({
  locale,
  parts,
  className = '',
}: {
  locale: string;
  parts?: RigPartDto[];
  className?: string;
}) {
  const S = useOnboarding();
  const [fetched, setFetched] = useState<RigPartDto[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const owned = parts ?? fetched;
  const selfFetch = parts === undefined;

  useEffect(() => {
    if (!selfFetch) return;
    let alive = true;
    const read = () => {
      getRig()
        .then((rig) => {
          if (!alive) return;
          setFetched([
            ...rig.grid.map((s) => s.part).filter((p): p is RigPartDto => p !== null),
            ...rig.inventory,
          ]);
        })
        // A missing banner is the right failure here — never a broken dashboard.
        .catch(() => alive && setFetched([]));
    };
    read();
    const id = setInterval(read, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [selfFetch]);

  // Drives the countdown; a minute is fine for a 72h clock.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const loaner = owned ? findLoaner(owned) : null;
  if (!loaner) return null;

  const msLeft = new Date(loaner.expiresAt).getTime() - now;
  const urgent = msLeft <= URGENT_HOURS * 3_600_000;

  return (
    <Panel
      hud
      tone={urgent ? 'heat' : 'charge'}
      className={`p-5 animate-rise ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
              urgent
                ? 'border-heat/40 bg-heat/12 text-heat'
                : 'border-charge/40 bg-charge/12 text-charge'
            }`}
          >
            <Icon name={urgent ? 'flame' : 'gift'} size={18} />
          </span>
          <div className="min-w-0">
            <Eyebrow tone={urgent ? 'default' : 'charge'}>{S.loaner.eyebrow}</Eyebrow>
            <h3 className="mt-1 font-display text-base font-bold text-ink">
              {fill(urgent ? S.loaner.endingSoon : S.loaner.running, { name: loaner.name })}
            </h3>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
            {S.loaner.timeLeft}
          </div>
          <div
            className={`v-num text-xl font-extrabold ${urgent ? 'text-heat' : 'text-charge'}`}
          >
            {remaining(loaner.expiresAt, now)}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        {urgent ? S.loaner.bodyUrgent : S.loaner.body}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/${locale}/boosters`}
          className={`v-btn ${urgent ? 'v-btn--charge' : 'v-btn--ghost'} v-btn--sm`}
        >
          {urgent ? S.loaner.cta : S.loaner.ctaCalm}
          <Icon name="chevron-right" size={14} />
        </Link>
        <Chip tone={urgent ? 'heat' : 'charge'}>
          <span className="v-num">+{loaner.hashPerHour.toFixed(1)}</span> VOLTS / h
        </Chip>
      </div>
    </Panel>
  );
}
