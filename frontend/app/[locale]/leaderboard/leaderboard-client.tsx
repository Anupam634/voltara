'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  getLeaderboard,
  getToken,
  LeaderboardCategory,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardResponse,
} from '../../../lib/api';
import { countryFlag, countryName } from '../../../lib/countries';
import { AppShell } from '../../../components/AppShell';
import { LogoMark } from '../../../components/Logo';
import {
  Button,
  Chip,
  Eyebrow,
  Gauge,
  Icon,
  Input,
  Notice,
  Panel,
  Progress,
  Reveal,
  Segmented,
  Skeleton,
  type IconName,
} from '../../../components/ui';
import Link from 'next/link';
import { useMiningFX } from '../../../lib/use-mining-fx';
import { useSocial } from '../../../components/social/strings';
import { SeasonPanel } from '../../../components/social/SeasonPanel';

const CATEGORIES: {
  key: LeaderboardCategory;
  icon: IconName;
  labelKey: 'catEarnings' | 'catBalance' | 'catReferrals';
  hintKey: 'catEarningsHint' | 'catBalanceHint' | 'catReferralsHint';
}[] = [
  { key: 'EARNINGS', icon: 'bolt', labelKey: 'catEarnings', hintKey: 'catEarningsHint' },
  { key: 'BALANCE', icon: 'wallet', labelKey: 'catBalance', hintKey: 'catBalanceHint' },
  { key: 'REFERRALS', icon: 'users', labelKey: 'catReferrals', hintKey: 'catReferralsHint' },
];

const PERIODS: {
  key: LeaderboardPeriod;
  labelKey: 'periodAllTime' | 'periodMonth' | 'periodWeek';
}[] = [
  { key: 'ALL_TIME', labelKey: 'periodAllTime' },
  { key: 'MONTH', labelKey: 'periodMonth' },
  { key: 'WEEK', labelKey: 'periodWeek' },
];

export default function LeaderboardClient({ locale }: { locale: string }) {
  const { LEADERBOARD_LINKS, WATCH } = useSocial();
  const t = useTranslations('leaderboard');
  const router = useRouter();
  const { playTick } = useMiningFX();

  const [category, setCategory] = useState<LeaderboardCategory>('EARNINGS');
  const [period, setPeriod] = useState<LeaderboardPeriod>('ALL_TIME');
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBoard(await getLeaderboard({ category, period, limit: 100 }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setLoading(false);
    }
  }, [category, period, t]);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/${locale}/login`);
      return;
    }
    load();
  }, [load, locale, router]);

  const activeCategory = CATEGORIES.find((c) => c.key === category)!;
  const unit = board?.unit === 'miners' ? t('unitMiners') : t('unitPoints');
  const decimals = board?.unit === 'miners' ? 0 : 2;

  const formatValue = useCallback(
    (value: number) =>
      value.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [decimals, locale],
  );

  const entries = board?.entries ?? [];
  const podium = entries.slice(0, 3);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.displayName.toLowerCase().includes(q) ||
        e.countryCode.toLowerCase().includes(q) ||
        String(e.rank) === q,
    );
  }, [entries, search]);

  const countryLabel = (code: string) =>
    code === 'GLOBAL' ? '—' : `${countryFlag(code)} ${countryName(code, locale)}`;

  return (
    <AppShell
      locale={locale}
      backLabel={t('back')}
      eyebrow="VOLTARA global rankings"
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <>
          {board && (
            <span className="v-num text-[11px] text-ink-3">
              {t('updated', { time: new Date(board.generatedAt).toLocaleTimeString(locale) })}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={load} loading={loading}>
            <Icon name="sparkle" size={12} />
            {t('refresh')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* ─── The grid: duels + squads ─── */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Reveal>
            <GridLinkCard
              href={`/${locale}/duels`}
              icon="bolt"
              title={LEADERBOARD_LINKS.duelsTitle}
              body={LEADERBOARD_LINKS.duelsBody}
              tone="charge"
            />
          </Reveal>
          <Reveal index={1}>
            <GridLinkCard
              href={`/${locale}/squad`}
              icon="users"
              title={LEADERBOARD_LINKS.squadTitle}
              body={LEADERBOARD_LINKS.squadBody}
              tone="brand"
            />
          </Reveal>
        </div>

        {/* ─── The weekly season: the one board that actually ends ─── */}
        <Reveal>
          <SeasonPanel locale={locale} />
        </Reveal>

        {/* ─── Your standing + controls ─── */}
        <div className="grid gap-5 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <YourRankCard board={board} loading={loading} unit={unit} formatValue={formatValue} />
          </Reveal>

          <Reveal index={1} className="lg:col-span-7">
            <Panel className="flex h-full flex-col gap-4 p-5 sm:p-6">
              <div>
                <Eyebrow>{t('categoryLabel')}</Eyebrow>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {CATEGORIES.map((c) => {
                    const active = c.key === category;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          playTick();
                          setCategory(c.key);
                        }}
                        className={`rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${
                          active
                            ? 'border-charge/50 bg-charge/[0.08] shadow-charge'
                            : 'border-line/20 bg-bg/40 hover:border-line/40 hover:bg-surface-2/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`grid h-7 w-7 place-items-center rounded-lg ${
                              active ? 'bg-charge/15 text-charge' : 'bg-brand/12 text-brand-hi'
                            }`}
                          >
                            <Icon name={c.icon} size={14} />
                          </span>
                          <span className={`text-sm font-extrabold ${active ? 'text-charge' : 'text-ink'}`}>
                            {t(c.labelKey)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">{t(c.hintKey)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-line/15 pt-4">
                <Eyebrow>{t('periodLabel')}</Eyebrow>
                <Segmented
                  value={board?.period ?? period}
                  options={PERIODS.map((p) => ({ value: p.key, label: t(p.labelKey) }))}
                  onChange={(v) => {
                    playTick();
                    setPeriod(v);
                  }}
                />
              </div>

              {/* Balance is a snapshot: say so rather than showing a period that
                  silently did not apply. */}
              {board && !board.periodSupported && (
                <Notice tone="brand" icon={<Icon name="help" size={14} />} className="text-[11px]">
                  {t('snapshotNotice')}
                </Notice>
              )}
            </Panel>
          </Reveal>
        </div>

        {error && (
          <Notice tone="heat" icon={<Icon name="x" size={14} />}>
            <p>{error}</p>
            <Button variant="danger" size="sm" className="mt-2" onClick={load}>
              {t('retry')}
            </Button>
          </Notice>
        )}

        {/* ─── Podium ─── */}
        {podium.length > 0 && (
          <Reveal>
            <Panel hud className="space-y-6 p-5 sm:p-8">
              <div>
                <Eyebrow tone="charge">
                  <Icon name={activeCategory.icon} size={11} className="mr-1 inline" />
                  {t(activeCategory.labelKey)} · {t('outOf', { total: board?.totalRanked ?? 0 })}
                </Eyebrow>
                <h2 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">{t('podium')}</h2>
              </div>

              <div className="grid items-end gap-3 sm:grid-cols-3">
                {/* 2nd, 1st, 3rd on desktop so the winner sits in the middle, raised. */}
                {[podium[1], podium[0], podium[2]].filter(Boolean).map((entry) => (
                  <PodiumCard
                    key={entry.id}
                    entry={entry}
                    unit={unit}
                    formatValue={formatValue}
                    countryLabel={countryLabel(entry.countryCode)}
                    youLabel={t('you')}
                  />
                ))}
              </div>
            </Panel>
          </Reveal>
        )}

        {/* ─── Full board ─── */}
        <Reveal>
          <Panel className="space-y-5 p-5 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Eyebrow>{t('outOf', { total: board?.totalRanked ?? 0 })}</Eyebrow>
                <h2 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">{t('fullBoard')}</h2>
              </div>
              <div className="relative w-full sm:w-60">
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="py-2 pl-9 text-xs"
                />
                <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-2.5 text-ink-3" />
              </div>
            </div>

            {loading && !board ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="v-inset p-8 text-center text-xs text-ink-3">
                <Icon name="trophy" size={28} className="mx-auto text-brand-hi" />
                <p className="mx-auto mt-3 max-w-md">{t('empty')}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="v-inset p-8 text-center text-xs text-ink-3">{t('noMatches')}</div>
            ) : (
              <div className="v-inset overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="v-glass border-b border-line/20 font-mono text-[10px] uppercase tracking-wider text-ink-3">
                      <th className="p-3.5">{t('rank')}</th>
                      <th className="p-3.5">{t('miner')}</th>
                      <th className="p-3.5">{t('country')}</th>
                      <th className="p-3.5">{t('statusCol')}</th>
                      <th className="p-3.5 text-right">{t('score')}</th>
                    </tr>
                  </thead>
                  <tbody className="v-stagger divide-y divide-line/10">
                    {filtered.map((entry) => (
                      <tr
                        key={entry.id}
                        className={
                          entry.isCurrentUser
                            ? 'bg-charge/[0.07] ring-1 ring-inset ring-charge/30'
                            : 'transition-colors hover:bg-surface-2/50'
                        }
                      >
                        <td className="v-num p-3.5 font-extrabold text-ink-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span>#{entry.rank}</span>
                            {entry.badge.medal && <span>{entry.badge.medal}</span>}
                          </span>
                        </td>
                        <td className="v-num p-3.5 font-bold text-ink">
                          <span className="inline-flex items-center gap-2">
                            {entry.watchCode ? (
                              <Link
                                href={`/${locale}/watch/${entry.watchCode}`}
                                className="truncate underline-offset-2 transition hover:text-charge hover:underline"
                                title={WATCH.watchCta}
                              >
                                {entry.displayName}
                              </Link>
                            ) : (
                              <span className="truncate">{entry.displayName}</span>
                            )}
                            {entry.isCurrentUser && (
                              <Chip tone="charge" className="px-1.5 py-0 text-[9px]">
                                {t('you')}
                              </Chip>
                            )}
                          </span>
                        </td>
                        <td className="v-num p-3.5 text-[11px] text-ink-2">{countryLabel(entry.countryCode)}</td>
                        <td className="p-3.5">
                          <Chip tone={entry.isMiningActive ? 'ok' : 'default'} dot={entry.isMiningActive} className="text-[10px]">
                            {entry.isMiningActive ? t('active') : t('idle')}
                          </Chip>
                        </td>
                        <td className="v-num p-3.5 text-right font-extrabold text-charge">
                          {formatValue(entry.value)}{' '}
                          <span className="text-[10px] font-bold text-ink-3">{unit}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* A miner outside the page still gets their own line, so the board
                is never a list they cannot find themselves in. */}
            {board && board.me.rank !== null && !board.me.inTopList && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-charge/30 bg-charge/[0.07] p-4">
                <div className="flex items-center gap-3">
                  <span className="v-num text-lg font-extrabold text-charge">#{board.me.rank}</span>
                  <div>
                    <div className="text-xs font-extrabold text-ink">{t('yourRank')}</div>
                    <div className="text-[11px] text-ink-3">{t('outOf', { total: board.totalRanked })}</div>
                  </div>
                </div>
                <div className="v-num text-right text-sm font-extrabold text-charge">
                  {formatValue(board.me.value)} <span className="text-[10px] font-bold text-ink-3">{unit}</span>
                </div>
              </div>
            )}
          </Panel>
        </Reveal>

        {/* ─── How ranks are calculated ─── */}
        <Reveal>
          <Notice icon={<Icon name="gauge" size={16} />}>
            <div className="text-xs font-extrabold text-ink">{t('integrityTitle')}</div>
            <p className="mt-1 text-[11px] leading-relaxed">{t('integrityBody')}</p>
          </Notice>
        </Reveal>
      </div>
    </AppShell>
  );
}

/* ───────────────────────── Grid links ───────────────────────── */

function GridLinkCard({
  href,
  icon,
  title,
  body,
  tone,
}: {
  href: string;
  icon: IconName;
  title: string;
  body: string;
  tone: 'charge' | 'brand';
}) {
  const { LEADERBOARD_LINKS } = useSocial();
  const accent =
    tone === 'charge'
      ? 'border-charge/35 bg-charge/10 text-charge'
      : 'border-brand/35 bg-brand/10 text-brand-hi';
  return (
    <Link href={href} className="block">
      <Panel lift trace className="flex items-center gap-4 p-4 sm:p-5">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${accent}`}>
          <Icon name={icon} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-bold text-ink">{title}</span>
          <span className="block text-xs text-ink-2">{body}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-extrabold text-ink-2">
          {LEADERBOARD_LINKS.open}
          <Icon name="chevron-right" size={13} />
        </span>
      </Panel>
    </Link>
  );
}

/* ───────────────────────── Your standing ───────────────────────── */

function YourRankCard({
  board,
  loading,
  unit,
  formatValue,
}: {
  board: LeaderboardResponse | null;
  loading: boolean;
  unit: string;
  formatValue: (value: number) => string;
}) {
  const t = useTranslations('leaderboard');
  const ranked = board?.me.rank ?? null;
  const percentile = board?.me.percentile ?? null;

  return (
    <Panel hud tone={ranked !== null ? 'charge' : 'default'} className="h-full p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>{t('yourRank')}</Eyebrow>
        <Chip tone="charge" className="v-num">
          {board?.me.badge.label ?? '—'}
        </Chip>
      </div>

      {loading && !board ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : ranked === null ? (
        <div className="mt-3 space-y-1">
          <div className="font-display text-2xl font-bold text-ink-2">{t('unranked')}</div>
          <p className="text-[11px] leading-relaxed text-ink-3">{t('unrankedHint')}</p>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="v-num text-4xl font-extrabold text-ink sm:text-5xl">#{ranked}</span>
              {board!.me.badge.medal && <span className="text-2xl">{board!.me.badge.medal}</span>}
            </div>
            <div className="mt-1 text-[11px] font-semibold text-ink-3">
              {t('outOf', { total: board!.totalRanked })}
            </div>
            <div className="mt-4 border-t border-line/15 pt-3">
              <Eyebrow>{t('yourScore')}</Eyebrow>
              <div className="v-num mt-1 text-lg font-extrabold text-charge">
                {formatValue(board!.me.value)} <span className="text-[10px] text-ink-3">{unit}</span>
              </div>
            </div>
            {percentile !== null && (
              <div className="mt-3 sm:hidden">
                <Eyebrow>{t('topPercent', { percent: percentile })}</Eyebrow>
                <Progress value={101 - percentile} charge className="mt-1.5" />
              </div>
            )}
          </div>
          {percentile !== null && (
            <div className="hidden shrink-0 sm:block">
              <Gauge value={101 - percentile} size={130} stroke={10} label={t('topPercent', { percent: percentile })} />
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ───────────────────────────── Podium ──────────────────────────── */

function PodiumCard({
  entry,
  unit,
  formatValue,
  countryLabel,
  youLabel,
}: {
  entry: LeaderboardEntry;
  unit: string;
  formatValue: (value: number) => string;
  countryLabel: string;
  youLabel: string;
}) {
  const first = entry.rank === 1;
  const ring =
    entry.rank === 1
      ? 'ring-charge/70 shadow-charge'
      : entry.rank === 2
        ? 'ring-brand-hi/60 shadow-volt'
        : 'ring-warn/60';

  return (
    <div
      className={`v-panel v-hud relative overflow-hidden p-5 text-center ${
        first ? 'v-panel--charge sm:-translate-y-3' : ''
      }`}
    >
      <div
        className={`mx-auto grid h-16 w-16 place-items-center rounded-full bg-surface-2/70 ring-2 ring-offset-2 ring-offset-bg ${ring}`}
      >
        <LogoMark size={34} glow={first} />
      </div>
      <div className="v-num mt-3 text-[10px] font-extrabold uppercase tracking-widest text-ink-3">
        #{entry.rank} {entry.badge.medal}
      </div>
      <div className="v-num mt-1 truncate text-sm font-extrabold text-ink">{entry.displayName}</div>
      <div className="mt-0.5 text-[11px] text-ink-3">{countryLabel}</div>
      <div className={`v-num mt-2 text-xl font-extrabold ${first ? 'text-charge' : 'text-brand-hi'}`}>
        {formatValue(entry.value)}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{unit}</div>
      {entry.isCurrentUser && (
        <span className="absolute right-3 top-3">
          <Chip tone="charge" className="px-1.5 py-0 text-[9px]">
            {youLabel}
          </Chip>
        </span>
      )}
    </div>
  );
}
