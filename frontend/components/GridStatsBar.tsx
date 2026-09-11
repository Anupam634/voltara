'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { getGridStats, type GridStatsDto } from '../lib/api-grid';
import { usePolling } from '../lib/use-polling';
import { AnimatedNumber, Icon, type IconName } from './ui';

const POLL_MS = 60_000;

/**
 * Copy for the strip. Same rule as the other `strings.ts` files: `en` is
 * written without `as const`, so `zh` / `ko` typed as `Copy` stop compiling
 * the moment a key goes missing.
 */
const en = {
  miners: 'Miners on the grid',
  online: 'Online now',
  mined: 'VOLTS mined (24h)',
  stability: 'Grid stability',
  countries: 'Countries',
  live: 'Live',
};

type Copy = typeof en;

const zh: Copy = {
  miners: '电网矿工',
  online: '当前在线',
  mined: 'VOLTS 产出（24 小时）',
  stability: '电网稳定度',
  countries: '国家/地区',
  live: '实时',
};

const ko: Copy = {
  miners: '그리드 채굴자',
  online: '현재 접속',
  mined: 'VOLTS 채굴 (24시간)',
  stability: '그리드 안정도',
  countries: '국가',
  live: '실시간',
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

interface Cell {
  key: keyof Omit<Copy, 'live'>;
  icon: IconName;
  value: number;
  decimals?: number;
  suffix?: string;
  cls: string;
}

/**
 * The counters under the hero.
 *
 * This replaces a marquee that generated its own content: random wallet
 * addresses, random amounts, and lines like "350 $VLTR paid out on BNB
 * Chain" — on a grid where no payout has happened yet and cannot happen
 * until the token launches. A miner who checks whether a payout page is
 * honest starts with the landing page, so the one thing this strip may
 * never do is make a number up.
 *
 * Everything here is measured server-side (`GET /api/grid/stats`). When the
 * API cannot be reached the strip renders nothing at all — an empty strip is
 * a smaller lie than a confident one.
 */
export function GridStatsBar() {
  const locale = useLocale();
  const S = BY_LOCALE[locale] ?? en;

  const [stats, setStats] = useState<GridStatsDto | null>(null);

  const load = useCallback(async () => {
    try {
      setStats(await getGridStats());
    } catch {
      // Leave whatever was last measured on screen; never substitute.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, POLL_MS);

  if (!stats) return null;

  const cells: Cell[] = [
    { key: 'miners', icon: 'users', value: stats.miners, cls: 'text-ink' },
    { key: 'online', icon: 'bolt', value: stats.onlineNow, cls: 'text-charge' },
    {
      key: 'mined',
      icon: 'chip',
      value: stats.voltsMined24h,
      decimals: 1,
      cls: 'text-brand-hi',
    },
    {
      key: 'stability',
      icon: 'shield',
      value: stats.stablePercent,
      suffix: '%',
      cls: stats.stablePercent >= 70 ? 'text-ok' : 'text-warn',
    },
    { key: 'countries', icon: 'globe', value: stats.countries, cls: 'text-ink' },
  ];

  return (
    <div className="border-y border-line/15 bg-bg/40 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4 sm:px-6 md:justify-between">
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-3">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-charge/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-charge" />
          </span>
          {S.live}
        </span>

        {cells.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-surface-2/80 text-ink-3">
              <Icon name={c.icon} size={12} />
            </span>
            <span className="flex items-baseline gap-1">
              <AnimatedNumber
                value={c.value}
                decimals={c.decimals ?? 0}
                className={`v-num text-sm font-extrabold ${c.cls}`}
              />
              {c.suffix && <span className={`text-sm font-bold ${c.cls}`}>{c.suffix}</span>}
            </span>
            <span className="text-xs text-ink-3">{S[c.key]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
