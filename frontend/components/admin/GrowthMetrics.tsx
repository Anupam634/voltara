'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, getOpsGrowth, type OpsGrowth } from '../../lib/admin-api';
import { AdminButton, Notice } from './ui';

/**
 * The four figures GROWTH.md §7 sets targets against.
 *
 * Three are measured. The fourth, share rate, is **not tracked anywhere** —
 * no share event is recorded — so it renders as an explicit blank with the
 * reason, never as a plausible-looking number. A fabricated metric here
 * would be worse than an empty tile, because targets get acted on: somebody
 * would decide the viral loop was working.
 *
 * Each tile carries its target so a number is readable without going back to
 * the playbook, and colours itself against that target rather than against
 * an arbitrary threshold.
 */
export function GrowthMetrics() {
  const [data, setData] = useState<OpsGrowth | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getOpsGrowth());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not compute growth metrics.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <Notice tone="bad">{error}</Notice>;
  }

  const k = data?.kFactor;
  const r = data?.retention;
  const p = data?.firstPurchase;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-white">Growth Targets</h3>
          <p className="text-xs text-slate-400">
            The four metrics GROWTH.md §7 sets targets for. Measured from the
            ledger, not estimated.
          </p>
        </div>
        <AdminButton onClick={load} icon="sparkle">
          Recompute
        </AdminButton>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="K-Factor"
          value={k?.value == null ? null : k.value.toFixed(2)}
          target={`≥ ${k?.target ?? 0.5}`}
          good={k?.value != null && k.value >= (k.target ?? 0.5)}
          note={
            k
              ? `${k.referredSignups} of ${k.totalSignups} signups referred, over ${k.baseUsers} existing miners (${k.windowDays}d)`
              : 'Loading…'
          }
          empty={k?.value == null ? 'Nobody existed at the start of the window yet.' : undefined}
        />

        <Metric
          label="D1 Retention"
          value={r?.d1 == null ? null : `${r.d1}%`}
          target={`${r?.targetD1 ?? 40}%`}
          good={r?.d1 != null && r.d1 >= (r.targetD1 ?? 40)}
          note={r ? `Cohort of ${r.cohortSize} — mined again the next day` : 'Loading…'}
          empty={r?.d1 == null ? 'No cohort old enough to measure yet.' : undefined}
        />

        <Metric
          label="D7 Retention"
          value={r?.d7 == null ? null : `${r.d7}%`}
          target={`${r?.targetD7 ?? 20}%`}
          good={r?.d7 != null && r.d7 >= (r.targetD7 ?? 20)}
          note={r ? `Same cohort — mined at all within the week` : 'Loading…'}
          empty={r?.d7 == null ? 'No cohort old enough to measure yet.' : undefined}
        />

        <Metric
          label="Signup → First $"
          value={p?.medianDays == null ? null : `${p.medianDays}d`}
          target={`≤ ${p?.targetDays ?? 7}d`}
          good={p?.medianDays != null && p.medianDays <= (p.targetDays ?? 7)}
          note={
            p
              ? `${p.payers} payers of ${p.totalUsers} (${p.conversionPercent ?? 0}%) · median`
              : 'Loading…'
          }
          empty={p?.medianDays == null ? 'No confirmed purchases yet.' : undefined}
        />
      </div>

      {/* The one that cannot be measured. Stated, not guessed. */}
      {data && (
        <div className="rounded-xl border border-white/[0.08] bg-slate-950/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Share Rate
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              target {data.shareRate.target}%
            </span>
          </div>
          <div className="mt-1 text-2xl font-black text-slate-600">Not measured</div>
          <p className="mt-1 text-xs text-slate-400">{data.shareRate.reason}</p>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  target,
  good,
  note,
  empty,
}: {
  label: string;
  value: string | null;
  target: string;
  good: boolean;
  note: string;
  /** Why the value is blank, when it is. */
  empty?: string;
}) {
  return (
    <div
      className={`card bg-slate-900/70 p-5 backdrop-blur-md ${
        value == null ? 'border-white/[0.08]' : good ? 'border-emerald-500/25' : 'border-amber-500/25'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {target}
        </span>
      </div>
      <div
        className={`mt-2 text-3xl font-black tabular-nums ${
          value == null ? 'text-slate-600' : good ? 'text-emerald-400' : 'text-amber-400'
        }`}
      >
        {value ?? '—'}
      </div>
      <div className="mt-1 text-xs text-slate-400">{empty ?? note}</div>
    </div>
  );
}
