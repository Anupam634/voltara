'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, getOpsSeasons, type OpsSeason, type OpsSeasons } from '../../../lib/admin-api';
import { Icon } from '../../ui';
import { AdminPage, Badge, Notice, StatGrid, StatTile, SyncButton, Table } from '../ui';

function when(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * What each season decided and what it paid.
 *
 * This is the ledger side of the weekly prize: VOLTS leave the system here
 * on a cron, with no human in the loop, so the operator needs to see that
 * the close job ran, who it paid, and how much — after the fact, from the
 * recorded awards rather than a recomputation.
 *
 * The state worth catching is a week that **ended but never closed**: the
 * cron did not fire, or it threw. That is called out rather than shown as a
 * quiet zero, because a zero and a missed payout look identical on a chart.
 */
export function SeasonsTab() {
  const [data, setData] = useState<OpsSeasons | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getOpsSeasons();
      setData(next);
      setOpen((cur) => cur ?? next.seasons.find((s) => s.closedAt)?.weekKey ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load seasons.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closed = data?.seasons.filter((s) => s.closedAt) ?? [];
  const stalled = data?.seasons.filter((s) => !s.running && !s.closedAt) ?? [];
  const paidTotal = closed.reduce((sum, s) => sum + s.paidVolts, 0);
  const paidMiners = closed.reduce((sum, s) => sum + s.paidCount, 0);

  return (
    <AdminPage
      icon="trophy"
      title="Weekly Seasons"
      subtitle="Monday-to-Monday prize weeks. Prizes are VOLTS, not $VLTR — the token is not on-chain and payouts are gated, so a $VLTR pool would be an IOU."
      actions={<SyncButton onClick={load} busy={loading && !!data} />}
      error={error}
      loading={loading && !data}
      loadingLabel="Loading seasons…"
    >
      {data && (
        <>
          {stalled.length > 0 && (
            <Notice tone="bad" title={`${stalled.length} season(s) ended without closing.`}>
              The Monday 00:10 UTC job did not settle {stalled.map((s) => s.weekKey).join(', ')}.
              Nobody was paid for those weeks. The job is idempotent and re-runs on boot,
              so a restart will settle them.
            </Notice>
          )}

          <StatGrid>
            <StatTile
              label="Current Week"
              value={data.currentWeekKey}
              note={`ends ${when(data.currentEndsAt)}`}
              tone="brand"
              live
            />
            <StatTile
              label="Pool / Week"
              value={data.poolVolts.toLocaleString()}
              note="VOLTS across 10 places"
              tone="brand"
            />
            <StatTile
              label="Seasons Paid"
              value={String(closed.length)}
              note={stalled.length ? `${stalled.length} stalled` : 'none stalled'}
              tone={stalled.length ? 'bad' : 'good'}
            />
            <StatTile
              label="VOLTS Paid Out"
              value={paidTotal.toLocaleString()}
              note={`to ${paidMiners} placings`}
              tone="good"
            />
          </StatGrid>

          {data.seasons.length === 0 ? (
            <div className="card border-white/10 bg-slate-900/70 p-10 text-center text-xs text-slate-400">
              No seasons yet. The first one opens on the next boot.
            </div>
          ) : (
            <div className="space-y-2">
              {data.seasons.map((s) => (
                <SeasonRow
                  key={s.weekKey}
                  season={s}
                  expanded={open === s.weekKey}
                  onToggle={() => setOpen(open === s.weekKey ? null : s.weekKey)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </AdminPage>
  );
}

function SeasonRow({
  season,
  expanded,
  onToggle,
}: {
  season: OpsSeason;
  expanded: boolean;
  onToggle: () => void;
}) {
  const stalled = !season.running && !season.closedAt;

  return (
    <div
      className={`card bg-slate-900/70 backdrop-blur-md ${
        stalled ? 'border-rose-500/40' : 'border-white/10'
      }`}
    >
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-black text-white">{season.weekKey}</span>
          {season.running ? (
            <Badge tone="live">Running</Badge>
          ) : stalled ? (
            <Badge tone="bad">Not settled</Badge>
          ) : (
            <Badge tone="good">Settled</Badge>
          )}
        </div>

        <div className="flex items-center gap-5 text-xs">
          <span className="text-slate-400">
            Paid <b className="tabular-nums text-slate-200">{season.paidCount}</b>
          </span>
          <span className="text-slate-400">
            <b className="tabular-nums text-amber-400">{season.paidVolts.toLocaleString()}</b> VOLTS
          </span>
          <span className="hidden tabular-nums text-slate-500 sm:inline">
            {when(season.closedAt)}
          </span>
          <Icon
            name="chevron-down"
            size={14}
            className={`text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
          {season.awards.length === 0 ? (
            <p className="text-xs text-slate-400">
              {season.running
                ? 'Still running — standings are live on the miner leaderboard.'
                : stalled
                  ? 'Never settled. No awards were written for this week.'
                  : 'Settled with no awards — nobody mined inside the window.'}
            </p>
          ) : (
            <Table head={['#', 'Miner', 'Mined', 'Prize']}>
              {season.awards.map((a) => (
                <tr key={a.userId}>
                  <td className="py-1.5 font-black tabular-nums text-slate-400">{a.rank}</td>
                  <td className="py-1.5 font-mono text-slate-300">{a.displayName}</td>
                  <td className="py-1.5 tabular-nums text-slate-400">
                    {a.earned.toLocaleString()}
                  </td>
                  <td className="py-1.5 text-right font-bold tabular-nums text-amber-400">
                    +{a.prize.toLocaleString()}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
