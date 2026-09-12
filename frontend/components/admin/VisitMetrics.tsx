'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, getOpsVisits, type OpsVisits } from '../../lib/admin-api';
import { AdminButton, Notice, Row, Section, StatTile } from './ui';

/**
 * Visits to the public site.
 *
 * The label says "sessions", not "users" or "people", everywhere — because
 * that is what the beacon can honestly count. One person on two tabs is two,
 * and coming back tomorrow is another. Calling it users would be the same
 * mistake as the invented token price: a number that reads as something more
 * certain than it is, on a screen where somebody makes decisions.
 *
 * The referrer list is the part worth watching. GROWTH.md §5a argues about
 * which cold-start channel deserves the effort; this is the only thing in the
 * product that can settle it with evidence rather than opinion. Direct
 * visits carry no referrer and so are absent from that list by design, not by
 * omission — which is why the total sits above it.
 */
export function VisitMetrics() {
  const [data, setData] = useState<OpsVisits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getOpsVisits());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not read visits.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <Notice tone="bad">{error}</Notice>;
  }

  const n = (v: number | undefined) => (v ?? 0).toLocaleString('en-US');
  const referrers = data?.byReferrer ?? [];
  const locales = data?.byLocale ?? [];
  const paths = data?.topPaths ?? [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-white">Site Visits</h3>
          <p className="text-xs text-slate-400">
            Browsing sessions on the public site, counted by a beacon that needs
            JavaScript — so bots are mostly absent.
          </p>
        </div>
        <AdminButton onClick={load} icon="sparkle" disabled={loading}>
          {loading ? 'Reading…' : 'Refresh'}
        </AdminButton>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="All time" value={n(data?.allTime)} note="sessions" />
        <StatTile label="Last 30 days" value={n(data?.last30d)} note="sessions" />
        <StatTile label="Last 7 days" value={n(data?.last7d)} note="sessions" />
        <StatTile label="Today (UTC)" value={n(data?.today)} note="sessions" live />
      </div>

      {data ? <Notice tone="warn" title="What this counts">{data.counts}</Notice> : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <Section title="Where they came from" aside={<span className="text-[11px] text-slate-500">30 days</span>}>
          {referrers.length === 0 ? (
            <p className="text-xs text-slate-500">
              No referred visits yet. Everything so far arrived directly — typed,
              bookmarked, or from an app that strips the referrer.
            </p>
          ) : (
            <div className="space-y-2">
              {referrers.map((r) => (
                <Row key={r.referrer} label={r.referrer} value={n(r.visits)} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Language" aside={<span className="text-[11px] text-slate-500">30 days</span>}>
          {locales.length === 0 ? (
            <p className="text-xs text-slate-500">Nothing recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {locales.map((l) => (
                <Row key={l.locale} label={l.locale} value={n(l.visits)} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Landing page" aside={<span className="text-[11px] text-slate-500">30 days</span>}>
          {paths.length === 0 ? (
            <p className="text-xs text-slate-500">Nothing recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {paths.map((p) => (
                <Row key={p.path} label={p.path} value={n(p.visits)} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </section>
  );
}
