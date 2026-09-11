'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSeason, type Season, type SeasonStanding } from '../../lib/api-social';
import { countryFlag } from '../../lib/countries';
import { Chip, Eyebrow, Icon, Panel, Skeleton } from '../ui';
import { useSocial } from './strings';

/** The board moves slowly and the page already polls plenty. */
const POLL_MS = 60_000;

/** "3d 4h" / "4h 12m" / "38m" / "0m". */
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

function volts(n: number, locale: string): string {
  return n.toLocaleString(locale, { maximumFractionDigits: 2 });
}

/**
 * The weekly season, on the leaderboard page.
 *
 * The boards above this are rolling windows — they never end, so nobody
 * ever wins one. This is the fixed Monday-to-Monday block that closes and
 * pays, so it leads with the two things that make a miner care: how long is
 * left, and what their current place is worth.
 *
 * While the season runs every prize here is a projection, and the panel
 * says so rather than implying the VOLTS are already banked.
 */
export function SeasonPanel({ locale }: { locale: string }) {
  const { SEASON } = useSocial();
  const [data, setData] = useState<{ current: Season; previous: Season | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const pull = () =>
      getSeason()
        .then((d) => {
          if (!alive) return;
          setData(d);
          setFailed(false);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    pull();
    const poll = setInterval(pull, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  // The season is one panel among many on this page; if the API misses,
  // showing nothing beats showing a table of zeroes that reads as real.
  if (failed && !data) return null;
  if (!data) {
    return (
      <Panel className="space-y-3 p-5 sm:p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </Panel>
    );
  }

  const { current, previous } = data;

  return (
    <div className="space-y-4">
      <Panel hud className="space-y-5 p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Eyebrow tone="charge">
              <Icon name="trophy" size={11} className="mr-1 inline" />
              {SEASON.eyebrow} · {current.weekKey}
            </Eyebrow>
            <h2 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">
              {SEASON.title}
            </h2>
            <p className="mt-1 max-w-prose text-[11px] leading-relaxed text-ink-3">{SEASON.body}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Chip tone="charge">
              <span className="v-num">{volts(current.poolVolts, locale)}</span> {SEASON.volts}
            </Chip>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
              {SEASON.pool}
            </span>
            <span className="v-num mt-1 text-[11px] text-ink-3">
              {SEASON.closesIn} {remaining(current.endsAt, now)}
            </span>
          </div>
        </div>

        <YourPlace season={current} locale={locale} />

        {current.standings.length === 0 ? (
          <div className="v-inset p-8 text-center text-xs text-ink-3">{SEASON.empty}</div>
        ) : (
          <StandingsTable
            standings={current.standings}
            locale={locale}
            projected
            watchLabel={SEASON.watch}
          />
        )}
      </Panel>

      {previous && previous.standings.length > 0 && (
        <Panel className="space-y-4 p-5 sm:p-6">
          <div>
            <Eyebrow>{SEASON.lastSeason}</Eyebrow>
            <p className="mt-1 text-[11px] text-ink-3">{SEASON.lastSeasonBody(previous.weekKey)}</p>
            {previous.me.prize > 0 && (
              <Chip tone="charge" className="mt-2">
                <Icon name="trophy" size={11} className="mr-1 inline" />
                {SEASON.youWon(previous.me.prize)}
              </Chip>
            )}
          </div>
          <StandingsTable
            standings={previous.standings}
            locale={locale}
            watchLabel={SEASON.watch}
          />
        </Panel>
      )}
    </div>
  );
}

/**
 * The caller's own row, whether or not they made the table.
 *
 * An unranked miner is told what to do about it: the gap between "not on
 * the board" and "mine anything this week" is the whole point of showing
 * this to somebody sitting at zero.
 */
function YourPlace({ season, locale }: { season: Season; locale: string }) {
  const { SEASON } = useSocial();
  const { rank, earned, prize, totalRanked } = season.me;

  if (rank === null) {
    return (
      <div className="v-inset flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-xs font-extrabold text-ink">{SEASON.unranked}</div>
          <p className="mt-0.5 text-[11px] text-ink-3">{SEASON.unrankedHint}</p>
        </div>
        <Icon name="bolt" size={20} className="text-ink-3" />
      </div>
    );
  }

  return (
    <div className="v-inset flex flex-wrap items-center justify-between gap-4 p-4">
      <div>
        <Eyebrow>{SEASON.yourPlace}</Eyebrow>
        <div className="v-num mt-1 text-2xl font-extrabold text-charge">#{rank}</div>
        <div className="text-[10px] text-ink-3">{SEASON.outOf(totalRanked)}</div>
      </div>
      <div>
        <Eyebrow>{SEASON.earned}</Eyebrow>
        <div className="v-num mt-1 text-lg font-extrabold text-brand-hi">{volts(earned, locale)}</div>
        <div className="text-[10px] text-ink-3">{SEASON.volts}</div>
      </div>
      <div className="text-right">
        <Eyebrow>{prize > 0 ? SEASON.prizeIfHolds : SEASON.prize}</Eyebrow>
        {prize > 0 ? (
          <>
            <div className="v-num mt-1 text-lg font-extrabold text-charge">
              +{volts(prize, locale)}
            </div>
            <div className="text-[10px] text-ink-3">{SEASON.projected}</div>
          </>
        ) : (
          <div className="mt-1 max-w-[16ch] text-[11px] leading-tight text-ink-3">
            {SEASON.noPrizeYet}
          </div>
        )}
      </div>
    </div>
  );
}

function StandingsTable({
  standings,
  locale,
  projected = false,
  watchLabel,
}: {
  standings: SeasonStanding[];
  locale: string;
  projected?: boolean;
  watchLabel: string;
}) {
  const { SEASON } = useSocial();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 px-3 text-[10px] font-bold uppercase tracking-wider text-ink-3">
        <span className="w-8">{SEASON.place}</span>
        <span className="flex-1">{SEASON.volts}</span>
        <span className="w-20 text-right">{SEASON.earned}</span>
        <span className="w-20 text-right">{projected ? SEASON.projected : SEASON.prize}</span>
      </div>
      {standings.map((s) => {
        const row = (
          <div
            className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
              s.isCurrentUser ? 'bg-charge/10 ring-1 ring-charge/40' : 'hover:bg-ink/5'
            }`}
          >
            <span
              className={`v-num w-8 text-sm font-extrabold ${
                s.rank <= 3 ? 'text-charge' : 'text-ink-3'
              }`}
            >
              {s.rank}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span aria-hidden>{countryFlag(s.countryCode)}</span>
              <span className="v-num truncate text-xs font-bold text-ink">{s.displayName}</span>
              {s.isCurrentUser && (
                <Chip tone="charge" className="px-1.5 py-0 text-[9px]">
                  {SEASON.you}
                </Chip>
              )}
            </span>
            <span className="v-num w-20 text-right text-xs font-bold text-ink-2">
              {volts(s.earned, locale)}
            </span>
            <span className="v-num w-20 text-right text-xs font-extrabold text-charge">
              {s.prize > 0 ? `+${volts(s.prize, locale)}` : '—'}
            </span>
          </div>
        );
        return s.watchCode ? (
          <Link
            key={s.id}
            href={`/${locale}/watch/${s.watchCode}`}
            className="block"
            title={watchLabel}
          >
            {row}
          </Link>
        ) : (
          <div key={s.id}>{row}</div>
        );
      })}
    </div>
  );
}
