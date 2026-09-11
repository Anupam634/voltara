'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, getRigWatch, getToken, type RigWatchDto, type WatchSlotDto } from '../../../../lib/api';
import { useSocial } from '../../../../components/social/strings';
import { LogoMark } from '../../../../components/Logo';
import { LocaleSwitcher } from '../../../../components/LocaleSwitcher';
import { ThemeToggle } from '../../../../components/ThemeToggle';
import { usePolling } from '../../../../lib/use-polling';
import {
  Chip,
  Eyebrow,
  Gauge,
  Icon,
  Notice,
  Panel,
  Skeleton,
  type IconName,
} from '../../../../components/ui';

const POLL_MS = 10_000;

function fmt(n: number, digits = 2): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const KIND_ICON: Record<string, IconName> = {
  CORE: 'chip',
  COOLER: 'snow',
  PSU: 'plug',
  MODULE: 'sparkle',
};

/**
 * Watching someone else's rig.
 *
 * Read-only by construction: it renders the public watch payload and nothing
 * else, so there is no path from spectating to touching another miner's
 * build. Polls rather than streams — a rig changes on the scale of minutes,
 * and a socket per spectator would be a lot of machinery for that.
 */
export default function WatchClient({ locale, code }: { locale: string; code: string }) {
  const { WATCH: S } = useSocial();

  const [rig, setRig] = useState<RigWatchDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  const load = useCallback(async () => {
    try {
      setRig(await getRigWatch(code));
      setNotFound(false);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err instanceof ApiError ? err.message : S.offline);
    }
  }, [code, S.offline]);

  useEffect(() => {
    setAuthed(!!getToken());
    load();
  }, [load]);

  usePolling(load, POLL_MS);

  return (
    <div className="min-h-dvh">
      <header className="v-glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link href={`/${locale}`} className="flex items-center gap-2.5" aria-label="VOLTARA">
            <LogoMark size={30} />
            <span className="hidden font-display text-sm font-bold tracking-[0.18em] text-ink sm:inline">
              VOLTARA
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}/leaderboard`}
              className="inline-flex items-center gap-1 rounded-full border border-line/25 px-2.5 py-1 text-[11px] font-bold text-ink-2 transition hover:border-brand-hi/60 hover:text-ink"
            >
              <Icon name="chevron-left" size={12} />
              {S.backToBoard}
            </Link>
            <ThemeToggle />
            <LocaleSwitcher locale={locale} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
        {notFound ? (
          <Notice tone="warn" icon={<Icon name="help" size={16} />}>
            {S.notFound}
          </Notice>
        ) : error && !rig ? (
          <Notice tone="heat" icon={<Icon name="x" size={16} />}>
            {error}
          </Notice>
        ) : !rig ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : (
          <WatchBody rig={rig} locale={locale} authed={authed} S={S} />
        )}
      </main>
    </div>
  );
}

function WatchBody({
  rig,
  locale,
  authed,
  S,
}: {
  rig: RigWatchDto;
  locale: string;
  authed: boolean;
  S: ReturnType<typeof useSocial>['WATCH'];
}) {
  const t = rig.telemetry;
  const tone = t.gridStability >= 95 ? 'charge' : t.gridStability < 60 ? 'heat' : 'default';

  return (
    <div className="animate-rise space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow tone="charge">{S.eyebrow}</Eyebrow>
          <h1 className="mt-2 truncate font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {rig.name}
          </h1>
          <p className="mt-1.5 text-sm text-ink-2">{S.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rig.overclocking && (
            <Chip tone="heat" dot>
              {S.overclocking}
            </Chip>
          )}
          {rig.event && <Chip tone="brand">{`${S.eventLive}: ${rig.event.title}`}</Chip>}
          {rig.countryCode && <Chip>{rig.countryCode}</Chip>}
        </div>
      </div>

      <Panel tone={tone} hud className="v-scanlines overflow-hidden p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="mx-auto lg:mx-0">
            <Gauge value={t.gridStability} size={150} label={S.stability} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Readout label={S.rate} value={`${fmt(rig.ratePerHour)}`} unit={S.perHour} tone="charge" />
            <Readout label={S.parts} value={`${t.installedCount}`} unit="" />
            <Meter
              label={S.thermal}
              used={t.heatLoad}
              cap={t.coolingCapacity}
              over={t.overheating}
              unit="TU"
            />
            <Meter
              label={S.power}
              used={t.powerDraw}
              cap={t.powerSupply}
              over={t.brownout}
              unit="W"
            />
          </div>
        </div>
      </Panel>

      <div className="rig-grid">
        {rig.slotsDetail.map((slot, i) => (
          <SlotCard key={i} slot={slot} S={S} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs text-ink-3">
          {rig.streakDays > 0 && (
            <Chip tone="charge">{`${S.streak} ${rig.streakDays} ${S.days}`}</Chip>
          )}
          <Chip>{`${S.joined} ${new Date(rig.joinedAt).toLocaleDateString()}`}</Chip>
        </div>
        <Link
          href={authed ? `/${locale}/duels` : `/${locale}/login?mode=register`}
          className="v-btn v-btn--charge"
        >
          {authed ? S.challenge : S.signUpToChallenge}
          <Icon name="chevron-right" size={16} />
        </Link>
      </div>
    </div>
  );
}

function Readout({
  label,
  value,
  unit,
  tone = 'default',
}: {
  label: string;
  value: string;
  unit: string;
  tone?: 'default' | 'charge';
}) {
  return (
    <div className="v-inset p-3">
      <div className="v-eyebrow">{label}</div>
      <div
        className={`v-num mt-1.5 text-2xl font-extrabold ${
          tone === 'charge' ? 'text-charge' : 'text-ink'
        }`}
      >
        {value}
        {unit && <span className="ml-1.5 text-[11px] font-bold text-ink-3">{unit}</span>}
      </div>
    </div>
  );
}

function Meter({
  label,
  used,
  cap,
  over,
  unit,
}: {
  label: string;
  used: number;
  cap: number;
  over: boolean;
  unit: string;
}) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  return (
    <div className="v-inset p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="v-eyebrow">{label}</span>
        <span className={`v-num text-xs font-bold ${over ? 'text-heat' : 'text-ink-2'}`}>
          {used} / {cap} {unit}
        </span>
      </div>
      <div className="stability-track mt-2">
        <div
          className={`stability-fill ${over ? 'stability-fill--critical' : pct >= 80 ? 'stability-fill--warn' : ''}`}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
    </div>
  );
}

function SlotCard({
  slot,
  S,
}: {
  slot: WatchSlotDto | null;
  S: ReturnType<typeof useSocial>['WATCH'];
}) {
  if (!slot) {
    return (
      <div className="rig-slot rig-slot--empty">
        <span className="text-[11px] font-bold uppercase tracking-wider">{S.empty}</span>
      </div>
    );
  }

  const kindClass = `rig-slot__kind rig-slot__kind--${slot.kind.toLowerCase()}`;
  return (
    <div
      className={`rig-slot rig-slot--filled ${slot.hot ? 'rig-slot--hot' : ''} ${
        slot.burned ? 'rig-slot--burned' : ''
      }`}
    >
      <span className={kindClass} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/12 text-brand-hi">
          <Icon name={KIND_ICON[slot.kind] ?? 'chip'} size={16} />
        </span>
        {slot.burned ? (
          <Chip tone="heat">{S.burned}</Chip>
        ) : slot.hot ? (
          <Chip tone="heat">{S.hot}</Chip>
        ) : null}
      </div>
      <div className="mt-2 min-w-0">
        <p className="truncate text-sm font-bold text-ink">{slot.name}</p>
        <p className="v-num mt-1 text-[11px] text-ink-3">
          {slot.heat > 0 && `${slot.heat} TU · `}
          {slot.cooling > 0 && `−${slot.cooling} TU · `}
          {slot.watts > 0 && `${slot.watts} W`}
          {slot.wattsSupplied > 0 && `+${slot.wattsSupplied} W`}
        </p>
      </div>
    </div>
  );
}
