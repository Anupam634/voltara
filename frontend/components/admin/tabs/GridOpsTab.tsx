'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, getOpsGrid, type OpsGrid, type OpsGridEvent } from '../../../lib/admin-api';
import { countryFlag, countryName } from '../../../lib/countries';
import { AdminPage, Badge, Notice, Section, StatGrid, StatTile, SyncButton, Table } from '../ui';

/** `+30%` / `−50%` / `—` — the sign is the whole point of these. */
function signed(n: number): string {
  if (n === 0) return '—';
  return `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;
}

function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "4h 12m" until an instant, or "ended". */
function until(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

/**
 * Grid operations.
 *
 * Answers what the miner-facing app cannot: is an event running and when
 * does it end, is the collective goal holding, did the weather feed actually
 * update, and how much of the fleet is running at all. Every figure comes
 * from the same services that score the rigs, so this panel and the miners'
 * dashboards cannot disagree.
 *
 * Read-only by design — there is no "fire an event" button. Starting an
 * event changes what every rig earns, and that belongs behind a deliberate
 * action, not one click away from a status page.
 */
export function GridOpsTab() {
  const [data, setData] = useState<OpsGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getOpsGrid());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not read the grid.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminPage
      icon="globe"
      title="Grid Operations"
      subtitle="The live state every rig is being scored against — events, real-world heat, the collective goal, and how much of the fleet is actually running."
      badge={data?.event.active ? 'Event running' : undefined}
      badgeTone="live"
      actions={<SyncButton onClick={load} busy={loading && !!data} />}
      error={error}
      loading={loading && !data}
      loadingLabel="Reading the grid…"
    >
      {data && (
        <>
          <StatGrid>
            <StatTile
              label="Rigs Running"
              value={data.stats.activeRigs.toLocaleString()}
              note={`${data.stats.miners.toLocaleString()} miners total`}
              tone="good"
              live={data.stats.activeRigs > 0}
            />
            <StatTile
              label="Grid Stability"
              value={`${data.stats.stablePercent}%`}
              note="Share of active rigs at 100%"
              tone={data.stats.stablePercent >= 50 ? 'good' : 'warn'}
            />
            <StatTile
              label="VOLTS Mined 24h"
              value={data.stats.voltsMined24h.toLocaleString()}
              note={`${data.stats.onlineNow.toLocaleString()} online now`}
              tone="brand"
            />
            <StatTile
              label="Overclocking"
              value={data.rigs.overclocking.toLocaleString()}
              note={`${data.rigs.slotsUsed.toLocaleString()} parts installed`}
              tone="brand"
            />
          </StatGrid>

          <Section title="Grid Event">
            {data.event.active ? (
              <EventRow event={data.event.active} state="active" />
            ) : (
              <p className="text-xs text-slate-400">
                No event running. Rigs are on their base physics.
              </p>
            )}
            {data.event.upcoming && <EventRow event={data.event.upcoming} state="upcoming" />}

            {data.event.recent.length > 0 && (
              <div className="mt-4 border-t border-white/[0.06] pt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Recent
                </div>
                <ul className="mt-2 space-y-1">
                  {data.event.recent.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-slate-300">{e.title}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">{when(e.endsAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section
            title="Collective Goal"
            aside={
              <Badge tone={data.collective.holding ? 'live' : 'neutral'}>
                {data.collective.holding
                  ? `Holding · +${data.collective.bonusPercent}%`
                  : 'Not met'}
              </Badge>
            }
          >
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  data.collective.holding ? 'bg-amber-400' : 'bg-violet-500'
                }`}
                style={{
                  width: `${Math.min(100, Math.round((data.collective.stablePercent / Math.max(1, data.collective.threshold)) * 100))}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {data.collective.stablePercent}% of {data.collective.active.toLocaleString()} active
              rigs are stable — the goal needs {data.collective.threshold}%.
            </p>
          </Section>

          <Section
            title="Real-World Heat"
            aside={
              <span className="text-[10px] text-slate-500">
                Feed updated {when(data.weather.updatedAt)}
              </span>
            }
          >
            {data.weather.countries.length === 0 ? (
              // A silent weather feed leaves every rig on the neutral
              // multiplier. Harmless for miners, but the operator should know
              // the third-party call is not coming back.
              <Notice tone="warn">
                No readings. Every rig is being scored at the neutral heat multiplier
                — check the Open-Meteo fetch.
              </Notice>
            ) : (
              <Table head={['Country', 'City', 'Temp', 'Cooling load']}>
                {data.weather.countries.map((w) => (
                  <tr key={w.countryCode}>
                    <td className="py-1.5 text-slate-300">
                      {countryFlag(w.countryCode)} {countryName(w.countryCode) || w.countryCode}
                    </td>
                    <td className="py-1.5 text-slate-400">{w.city}</td>
                    <td className="py-1.5 tabular-nums text-slate-300">{w.tempC}°C</td>
                    <td
                      className={`py-1.5 text-right font-bold tabular-nums ${
                        w.heatPercent > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {signed(w.heatPercent)}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
        </>
      )}
    </AdminPage>
  );
}

function EventRow({ event, state }: { event: OpsGridEvent; state: 'active' | 'upcoming' }) {
  return (
    <div
      className={`mt-1 rounded-xl border p-3 ${
        state === 'active'
          ? 'border-amber-500/30 bg-amber-500/[0.07]'
          : 'border-white/10 bg-slate-950/40'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-black text-white">{event.title}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {state === 'active' ? `ends in ${until(event.endsAt)}` : `starts ${when(event.startsAt)}`}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{event.body}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] tabular-nums">
        <span className="text-slate-400">
          Heat <b className="text-slate-200">{signed(event.heatPercent)}</b>
        </span>
        <span className="text-slate-400">
          Draw <b className="text-slate-200">{signed(event.drawPercent)}</b>
        </span>
        <span className="text-slate-400">
          Hash <b className="text-slate-200">{signed(event.hashPercent)}</b>
        </span>
      </div>
    </div>
  );
}
