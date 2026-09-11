'use client';

import { useEffect, useState } from 'react';
import { getGridEvent, type GridEventCode, type GridEventDto, type GridEventFeed } from '../../lib/api-grid';
import { Chip, Icon, Panel, type IconName } from '../ui';
import { useS } from './strings';

const POLL_MS = 60_000;

/** Which way each event pushes the grid, and how it should look. */
const EVENT_STYLE: Record<GridEventCode, { tone: 'heat' | 'charge'; icon: IconName }> = {
  HEATWAVE: { tone: 'heat', icon: 'flame' },
  GRID_STRAIN: { tone: 'heat', icon: 'plug' },
  CHEAP_POWER: { tone: 'charge', icon: 'plug' },
  SOLAR_SURGE: { tone: 'charge', icon: 'sparkle' },
  COLD_SNAP: { tone: 'charge', icon: 'snow' },
};

function styleFor(code: string) {
  return EVENT_STYLE[code as GridEventCode] ?? { tone: 'charge' as const, icon: 'bolt' as const };
}

/** "4h 12m" / "38m" / "0m". */
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

function signed(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%`;
}

/** The effect chips: only the multipliers that actually move. */
function EffectChips({ event, compact = false }: { event: GridEventDto; compact?: boolean }) {
  const S = useS();
  const items: { label: string; value: number; good: boolean }[] = [
    { label: S.event.heat, value: event.heatPercent, good: event.heatPercent < 0 },
    { label: S.event.draw, value: event.drawPercent, good: event.drawPercent < 0 },
    { label: S.event.hash, value: event.hashPercent, good: event.hashPercent > 0 },
  ].filter((i) => i.value !== 0);
  return (
    <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {items.map((i) => (
        <Chip key={i.label} tone={i.good ? 'charge' : 'heat'} className={compact ? 'px-2 py-0.5 text-[10px]' : ''}>
          <span className="v-num">{signed(i.value)}</span> {i.label}
        </Chip>
      ))}
    </div>
  );
}

/**
 * Fetches the event feed once and keeps it fresh; shared by both variants so
 * a page with two banners does not poll twice.
 */
export function useGridEvents(): { feed: GridEventFeed | null; now: number } {
  const [feed, setFeed] = useState<GridEventFeed | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const pull = () =>
      getGridEvent()
        .then((f) => alive && setFeed(f))
        .catch(() => {
          /* the grid feed is decorative; a miss just leaves the last state */
        });
    pull();
    const poll = setInterval(pull, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  // Roll an event that just ended off the banner without waiting for the poll.
  const active = feed?.active && new Date(feed.active.endsAt).getTime() > now ? feed.active : null;
  const upcoming = feed?.upcoming && new Date(feed.upcoming.startsAt).getTime() > now ? feed.upcoming : null;
  return { feed: feed ? { ...feed, active, upcoming } : null, now };
}

/**
 * The event banner. Active → a full panel in the event's colour with a live
 * countdown. Upcoming → one quiet line. Nothing → nothing.
 */
export function GridEventBanner({
  variant = 'full',
  className = '',
}: {
  variant?: 'full' | 'compact';
  className?: string;
}) {
  const S = useS();
  const { feed, now } = useGridEvents();
  if (!feed) return null;

  if (feed.active) {
    const ev = feed.active;
    const style = styleFor(ev.code);
    if (variant === 'compact') {
      return (
        <div className={`v-inset flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 ${className}`}>
          <span className={`flex items-center gap-1.5 text-xs font-extrabold ${style.tone === 'heat' ? 'text-heat' : 'text-charge'}`}>
            <span className={`v-dot ${style.tone === 'heat' ? 'v-dot--heat' : ''}`} />
            <Icon name={style.icon} size={13} />
            {ev.title}
          </span>
          <EffectChips event={ev} compact />
          <span className="ml-auto v-num text-[11px] font-bold text-ink-3">
            {S.event.endsIn} {remaining(ev.endsAt, now)}
          </span>
        </div>
      );
    }
    return (
      <Panel tone={style.tone} hud className={`v-scanlines relative overflow-hidden p-4 animate-rise sm:p-5 ${className}`}>
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
              style.tone === 'heat' ? 'bg-heat/15 text-heat' : 'bg-charge/15 text-charge'
            }`}
          >
            <Icon name={style.icon} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`v-eyebrow ${style.tone === 'heat' ? 'text-heat' : 'v-eyebrow--charge'}`}>
                <span className={`v-dot mr-1.5 ${style.tone === 'heat' ? 'v-dot--heat' : ''}`} />
                {S.event.liveNow}
              </span>
              <EffectChips event={ev} />
            </div>
            <p className="mt-1 font-display text-lg font-bold leading-tight text-ink">{ev.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2 sm:text-sm">{ev.body}</p>
          </div>
          <div className="v-inset shrink-0 px-3.5 py-2 text-right">
            <div className="v-eyebrow">{S.event.endsIn}</div>
            <div className={`v-num mt-0.5 text-xl font-extrabold ${style.tone === 'heat' ? 'text-heat' : 'text-charge'}`}>
              {remaining(ev.endsAt, now)}
            </div>
          </div>
        </div>
        {style.tone === 'charge' && <div className="v-trace mt-3" />}
      </Panel>
    );
  }

  if (feed.upcoming) {
    const ev = feed.upcoming;
    const style = styleFor(ev.code);
    return (
      <div className={`v-inset flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2 text-xs ${className}`}>
        <Icon name={style.icon} size={13} className="text-ink-3" />
        <span className="text-ink-2">
          {S.event.nextIn} <span className="v-num font-bold text-ink">{remaining(ev.startsAt, now)}</span>:{' '}
          <span className="font-bold text-ink">{ev.title}</span>
        </span>
        <span className="ml-auto">
          <EffectChips event={ev} compact />
        </span>
      </div>
    );
  }

  return null;
}
