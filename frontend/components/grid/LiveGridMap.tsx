'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getGridMap, type GridMapDto } from '../../lib/api-grid';
import { Chip, Eyebrow, Icon, Panel, Skeleton } from '../ui';
import { useS } from './strings';

/**
 * Approximate country centroids, [lat, lng]. Enough to place a dot for
 * every country that plausibly has a miner; codes not listed are skipped.
 */
const CENTROIDS: Record<string, [number, number]> = {
  US: [39.8, -98.6], CA: [56.1, -106.3], MX: [23.6, -102.6], BR: [-14.2, -51.9], AR: [-38.4, -63.6],
  CL: [-35.7, -71.5], CO: [4.6, -74.3], PE: [-9.2, -75.0], VE: [6.4, -66.6], EC: [-1.8, -78.2],
  GB: [54.0, -2.5], IE: [53.4, -8.2], FR: [46.6, 2.2], DE: [51.2, 10.4], ES: [40.5, -3.7],
  PT: [39.4, -8.2], IT: [42.5, 12.5], NL: [52.1, 5.3], BE: [50.5, 4.5], CH: [46.8, 8.2],
  AT: [47.5, 14.6], PL: [51.9, 19.1], CZ: [49.8, 15.5], SE: [62.0, 15.0], NO: [64.0, 12.0],
  FI: [64.0, 26.0], DK: [56.3, 9.5], UA: [48.4, 31.2], RO: [45.9, 25.0], GR: [39.1, 22.0],
  TR: [39.0, 35.2], RU: [61.5, 90.0], KZ: [48.0, 68.0], UZ: [41.4, 64.6], GE: [42.3, 43.4],
  SA: [24.0, 45.0], AE: [23.4, 53.8], IL: [31.0, 34.9], IR: [32.4, 53.7], IQ: [33.2, 43.7],
  EG: [26.8, 30.8], MA: [31.8, -7.1], DZ: [28.0, 1.7], NG: [9.1, 8.7], GH: [7.9, -1.0],
  KE: [-0.02, 37.9], ET: [9.1, 40.5], TZ: [-6.4, 34.9], ZA: [-30.6, 22.9], CM: [7.4, 12.4],
  CI: [7.5, -5.5], SN: [14.5, -14.5], UG: [1.4, 32.3], ZW: [-19.0, 29.2], MZ: [-18.7, 35.5],
  IN: [20.6, 78.9], PK: [30.4, 69.3], BD: [23.7, 90.4], LK: [7.9, 80.8], NP: [28.4, 84.1],
  CN: [35.9, 104.2], JP: [36.2, 138.3], KR: [35.9, 127.8], TW: [23.7, 121.0], HK: [22.3, 114.2],
  VN: [14.1, 108.3], TH: [15.9, 100.9], MY: [4.2, 101.9], SG: [1.35, 103.8], ID: [-2.5, 118.0],
  PH: [12.9, 121.8], MM: [19.8, 96.7], KH: [12.6, 105.0], MN: [46.9, 103.8], AU: [-25.3, 133.8],
  NZ: [-40.9, 174.9], PG: [-6.3, 143.9],
};

/** Equirectangular projection onto a W×H box. */
function project(lat: number, lng: number, w: number, h: number): [number, number] {
  return [((lng + 180) / 360) * w, ((90 - lat) / 180) * h];
}

function toneFor(stable: number): 'charge' | 'warn' | 'heat' {
  return stable >= 90 ? 'charge' : stable >= 60 ? 'warn' : 'heat';
}

const TONE_COLOR: Record<'charge' | 'warn' | 'heat', string> = {
  charge: 'rgb(var(--c-charge))',
  warn: 'rgb(var(--c-warn))',
  heat: 'rgb(var(--c-heat))',
};

function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Every rig on the grid as a constellation: one glowing dot per country,
 * sized by miners and coloured by how many of them hold 100% stability.
 * Pure SVG, so it stays crisp at any width and costs nothing to animate.
 */
export function LiveGridMap({
  size = 'lg',
  locale = 'en',
  className = '',
}: {
  size?: 'lg' | 'sm';
  locale?: string;
  className?: string;
}) {
  const S = useS();
  const [data, setData] = useState<GridMapDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const pull = () =>
      getGridMap()
        .then((d) => {
          if (!alive) return;
          setData(d);
          setFailed(false);
        })
        .catch(() => alive && !data && setFailed(true));
    pull();
    const id = setInterval(pull, 120_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const W = 720;
  const H = 360;

  const dots = useMemo(() => {
    if (!data) return [];
    const max = Math.max(1, ...data.countries.map((c) => c.miners));
    return data.countries
      .filter((c) => CENTROIDS[c.code])
      .map((c) => {
        const [lat, lng] = CENTROIDS[c.code];
        const [x, y] = project(lat, lng, W, H);
        // Square-root scale so one huge country does not drown the rest.
        const r = 3 + Math.sqrt(c.miners / max) * (size === 'lg' ? 14 : 10);
        return { ...c, x, y, r, tone: toneFor(c.stablePercent), big: c.miners >= max * 0.5 };
      })
      .sort((a, b) => b.r - a.r);
  }, [data, size]);

  const hovered = hover ? dots.find((d) => d.code === hover.code) : null;

  const stats = data
    ? [
        { label: S.map.totalRigs, value: data.totalRigs.toLocaleString(), tone: 'default' as const },
        { label: S.map.onlineNow, value: data.onlineNow.toLocaleString(), tone: 'charge' as const },
        { label: S.map.stable, value: `${Math.round(data.stablePercent)}%`, tone: toneFor(data.stablePercent) },
      ]
    : [];

  return (
    <Panel hud className={`v-scanlines relative overflow-hidden ${size === 'lg' ? 'p-5 sm:p-6' : 'p-4'} ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow tone="charge">
            <span className="v-dot mr-1.5" />
            {S.map.eyebrow}
          </Eyebrow>
          {size === 'lg' && (
            <p className="mt-1.5 text-xs leading-relaxed text-ink-2 sm:text-sm">{S.map.subtitle}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.map((s) => (
            <div key={s.label} className="v-inset px-3 py-1.5 text-right">
              <div className="v-eyebrow">{s.label}</div>
              <div
                className={`v-num text-base font-extrabold leading-tight ${
                  s.tone === 'charge' ? 'text-charge' : s.tone === 'warn' ? 'text-warn' : s.tone === 'heat' ? 'text-heat' : 'text-ink'
                }`}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div ref={boxRef} className="relative mt-4 w-full max-w-full" style={{ aspectRatio: '2 / 1' }}>
        {!data && !failed && (
          <div className="absolute inset-0 grid place-items-center">
            <Skeleton className="absolute inset-0 rounded-xl" />
            <span className="relative text-xs font-bold text-ink-3">{S.map.loading}</span>
          </div>
        )}
        {failed && !data && (
          <div className="absolute inset-0 grid place-items-center rounded-xl border border-dashed border-line/30 text-xs text-ink-3">
            {S.map.offline}
          </div>
        )}
        {data && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-full w-full overflow-visible"
            onMouseLeave={() => setHover(null)}
            role="img"
            aria-label={S.map.title}
          >
            <defs>
              <radialGradient id="lgm-glow">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.55" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Graticule */}
            <g stroke="rgb(var(--c-line) / 0.16)" strokeWidth="1">
              {[-60, -30, 0, 30, 60].map((lat) => {
                const y = project(lat, 0, W, H)[1];
                return <line key={`lat${lat}`} x1={0} x2={W} y1={y} y2={y} strokeDasharray={lat === 0 ? '0' : '3 6'} />;
              })}
              {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lng) => {
                const x = project(0, lng, W, H)[0];
                return <line key={`lng${lng}`} x1={x} x2={x} y1={0} y2={H} strokeDasharray={lng === 0 ? '0' : '3 6'} />;
              })}
            </g>
            <rect x={0} y={0} width={W} height={H} rx={12} fill="none" stroke="rgb(var(--c-line) / 0.25)" />

            {dots.map((d) => (
              <g
                key={d.code}
                style={{ color: TONE_COLOR[d.tone] }}
                onMouseEnter={() => setHover({ code: d.code, x: d.x, y: d.y })}
                onClick={() => setHover(hover?.code === d.code ? null : { code: d.code, x: d.x, y: d.y })}
                className="cursor-pointer"
              >
                <circle cx={d.x} cy={d.y} r={d.r * 2.6} fill="url(#lgm-glow)" />
                {d.big && (
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={d.r}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="origin-center animate-[v-pulse-ring_2.4s_cubic-bezier(0.215,0.61,0.355,1)_infinite]"
                    style={{ transformOrigin: `${d.x}px ${d.y}px` }}
                  />
                )}
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={d.r}
                  fill="currentColor"
                  stroke="rgb(var(--c-bg))"
                  strokeWidth="1.5"
                  opacity={hover && hover.code !== d.code ? 0.55 : 1}
                />
              </g>
            ))}
          </svg>
        )}

        {hovered && hover && (
          <div
            className="v-panel v-glass pointer-events-none absolute z-10 min-w-[9rem] -translate-x-1/2 -translate-y-full px-3 py-2 text-xs animate-pop"
            style={{ left: `${(hover.x / W) * 100}%`, top: `calc(${(hover.y / H) * 100}% - ${hovered.r + 6}px)` }}
          >
            <div className="font-extrabold text-ink">{countryName(hovered.code, locale)}</div>
            <div className="mt-0.5 flex items-center justify-between gap-3 text-ink-2">
              <span>
                <span className="v-num font-bold text-ink">{hovered.miners}</span> {S.map.miners}
              </span>
              <span style={{ color: TONE_COLOR[hovered.tone] }} className="v-num font-bold">
                {Math.round(hovered.stablePercent)}% {S.map.stableShort}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip tone="charge" dot>{S.map.legendStable}</Chip>
        <Chip tone="warn" dot>{S.map.legendWarm}</Chip>
        <Chip tone="heat" dot>{S.map.legendHot}</Chip>
        {data && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-3">
            <Icon name="users" size={11} />
            <span className="v-num">{data.activeRigs.toLocaleString()}</span> {S.map.activeWeek.toLowerCase()}
          </span>
        )}
      </div>
    </Panel>
  );
}
