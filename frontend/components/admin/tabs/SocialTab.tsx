'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, getOpsSocial, type OpsSocial } from '../../../lib/admin-api';
import { AdminPage, Notice, Row, Section, StatGrid, StatTile, SyncButton } from '../ui';

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
 * The competitive and social surfaces, in one place.
 *
 * Each has a scheduled job behind it — duels settle after 24h, the blueprint
 * challenge pays out on Monday, the puzzle rolls at midnight — and none was
 * visible to an operator before. The numbers here are mostly about liveness:
 * a market with no active listings, a challenge whose rewards never granted,
 * or a week with zero submissions each mean something is either unused or
 * broken, and the two are worth telling apart early.
 */
export function SocialTab() {
  const [data, setData] = useState<OpsSocial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getOpsSocial());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the social surfaces.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const challengeEnded =
    !!data?.challenge.endsAt && new Date(data.challenge.endsAt).getTime() <= Date.now();
  const challengeUnpaid = challengeEnded && !data?.challenge.rewardsGrantedAt;

  return (
    <AdminPage
      icon="swords"
      title="Competitive & Social"
      subtitle="Duels, squads, the part market, the weekly blueprint challenge, the daily puzzle and apprenticeships — and whether their scheduled jobs are actually running."
      actions={<SyncButton onClick={load} busy={loading && !!data} />}
      error={error}
      loading={loading && !data}
    >
      {data && (
        <>
          {challengeUnpaid && (
            <Notice
              tone="bad"
              title={`Blueprint challenge ${data.challenge.weekKey} ended without paying.`}
            >
              The Monday 00:05 UTC roll has not granted its rewards. The job retries on
              boot and is idempotent.
            </Notice>
          )}

          <StatGrid>
            <StatTile
              label="Duels Active"
              value={String(data.duels.active)}
              note={`${data.duels.open} open · ${data.duels.settled} settled`}
              tone="brand"
              live={data.duels.active > 0}
            />
            <StatTile
              label="Squads"
              value={String(data.squads.total)}
              note={`${data.squads.members} miners pooled`}
              tone="brand"
            />
            <StatTile
              label="Market Listings"
              value={String(data.market.active)}
              note={`${data.market.sold} sold all-time`}
              tone="brand"
            />
            <StatTile
              label="Market Fees 7d"
              value={data.market.feesWeekVolts.toLocaleString()}
              note="VOLTS taken as the 5% cut"
              tone="good"
            />
          </StatGrid>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Weekly Blueprint Challenge">
              {data.challenge.weekKey ? (
                <dl className="space-y-2">
                  <Row label="Week" value={data.challenge.weekKey} />
                  <Row label="Brief" value={data.challenge.title ?? '—'} />
                  <Row label="Ends" value={when(data.challenge.endsAt)} />
                  <Row
                    label="Rewards granted"
                    value={when(data.challenge.rewardsGrantedAt)}
                    tone={challengeUnpaid ? 'bad' : 'neutral'}
                  />
                  <Row label="Submissions (7d)" value={String(data.challenge.submissionsWeek)} />
                </dl>
              ) : (
                <p className="text-xs text-slate-400">
                  No challenge row yet — one is created on the next boot or Monday roll.
                </p>
              )}
            </Section>

            <Section title="Daily Puzzle & Mentors">
              <dl className="space-y-2">
                <Row label="Latest puzzle" value={data.daily.dayKey ?? '—'} />
                <Row label="Solves (7d)" value={String(data.daily.solvesWeek)} />
                <Row label="Apprenticeships" value={String(data.apprenticeships.total)} />
                <Row
                  label="Mentor cut paid (7d)"
                  value={`${data.apprenticeships.cutPaidWeekVolts.toLocaleString()} VOLTS`}
                />
              </dl>
              {/* The mentor cut is newly minted, not taken from the apprentice —
                  so it is a real emission line, worth watching next to revenue. */}
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                The mentor cut is minted on top of what the apprentice earns; it is not
                deducted from them. Treat it as an emission, not a transfer.
              </p>
            </Section>
          </div>

          <Section title="Duel Outcomes">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Mini label="Open" value={data.duels.open} />
              <Mini label="Active" value={data.duels.active} />
              <Mini label="Settled" value={data.duels.settled} />
              <Mini label="Expired" value={data.duels.expired} tone="warn" />
              <Mini label="Cancelled" value={data.duels.cancelled} />
            </div>
            {data.duels.expired > data.duels.settled && data.duels.expired > 0 && (
              <p className="mt-3 text-[11px] text-amber-300">
                More duels expire unaccepted than ever settle — the share link is being
                created but not taken up.
              </p>
            )}
          </Section>
        </>
      )}
    </AdminPage>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: 'warn' }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-950/40 p-3 text-center">
      <div
        className={`text-xl font-black tabular-nums ${
          tone === 'warn' ? 'text-amber-300' : 'text-slate-200'
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}
