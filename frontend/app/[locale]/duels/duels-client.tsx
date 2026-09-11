'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError, getToken } from '../../../lib/api';
import {
  cancelDuel,
  createDuel,
  getMyDuels,
  untilLabel,
  type DuelDto,
  type DuelSide,
  type MyDuels,
} from '../../../lib/api-social';
import { useSocial } from '../../../components/social/strings';
import { AppShell } from '../../../components/AppShell';
import {
  AnimatedNumber,
  Button,
  Chip,
  Eyebrow,
  Gauge,
  Icon,
  Notice,
  Panel,
  Progress,
  Reveal,
  Skeleton,
  type IconName,
} from '../../../components/ui';
import { useMiningFX } from '../../../lib/use-mining-fx';
import { usePolling } from '../../../lib/use-polling';

const REFRESH_MS = 20_000;

function fmt(n: number, digits = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function DuelsClient() {
  const S = useSocial().DUELS;
  const t = useTranslations('dashboard');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const { playTick, playClaimReward, playError } = useMiningFX();

  const [data, setData] = useState<MyDuels | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
  // Re-render the countdowns once a minute without refetching.
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      setData(await getMyDuels());
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.replace(`/${locale}/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : S.offline);
    }
  }, [router, locale]);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/${locale}/login`);
      return;
    }
    setOrigin(window.location.origin);
    load();
  }, [load, router, locale]);

  usePolling(load, REFRESH_MS);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      playTick();
      const duel = await createDuel();
      setData((d) => (d ? { ...d, open: duel } : { open: duel, active: null, history: [] }));
      setError(null);
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : S.offline);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (code: string) => {
    setBusy(true);
    try {
      playTick();
      await cancelDuel(code);
      await load();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : S.offline);
    } finally {
      setBusy(false);
    }
  };

  const shareUrl = data?.open ? `${origin}/${locale}/duel/${data.open.code}` : '';

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      playTick();
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  const nativeShare = async () => {
    if (!shareUrl || !data?.open) return;
    const text = S.shareText(fmt(data.open.challenger.ratePerHour));
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'VOLTARA duel', text, url: shareUrl });
        playClaimReward();
        return;
      } catch {
        /* dismissed */
      }
    }
    copy();
  };

  const shareText = data?.open ? encodeURIComponent(S.shareText(fmt(data.open.challenger.ratePerHour))) : '';
  const encodedUrl = encodeURIComponent(shareUrl);

  return (
    <AppShell locale={locale} backLabel={t('navDashboard')} eyebrow={S.eyebrow} title={S.title} subtitle={S.subtitle}>
      <div className="space-y-6">
        {error && (
          <Notice tone="heat" icon={<Icon name="x" size={16} />}>
            {error}
          </Notice>
        )}

        {!data ? (
          <DuelsSkeleton />
        ) : (
          <>
            {/* ─── Active race ─── */}
            {data.active && (
              <Reveal>
                <ActiveDuel duel={data.active} />
              </Reveal>
            )}

            {/* ─── Open challenge: share card ─── */}
            {data.open && (
              <Reveal index={data.active ? 1 : 0}>
                <Panel hud tone="charge" className="p-5 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Eyebrow tone="charge">{S.openEyebrow}</Eyebrow>
                      <h2 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">{S.openTitle}</h2>
                      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">{S.openBody}</p>
                    </div>
                    <Chip tone="charge" dot>
                      {S.rate} {fmt(data.open.challenger.ratePerHour)}
                    </Chip>
                  </div>

                  <div className="mt-5">
                    <span className="v-label">{S.link}</span>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="v-inset v-num min-w-0 flex-1 truncate px-3.5 py-3 text-xs text-ink-2">{shareUrl}</div>
                      <Button variant="charge" onClick={copy} className="shrink-0">
                        <Icon name={copied ? 'check' : 'copy'} size={14} />
                        {copied ? S.copied : S.copy}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={nativeShare}>
                      <Icon name="share" size={13} />
                      {S.share}
                    </Button>
                    <ShareLink
                      href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`}
                      label={S.shareX}
                    />
                    <ShareLink
                      href={`https://t.me/share/url?url=${encodedUrl}&text=${shareText}`}
                      label={S.shareTelegram}
                    />
                    <ShareLink href={`https://wa.me/?text=${shareText}%20${encodedUrl}`} label={S.shareWhatsApp} />
                    <Button
                      variant="danger"
                      size="sm"
                      className="ml-auto"
                      loading={busy}
                      onClick={() => cancel(data.open!.code)}
                    >
                      <Icon name="x" size={13} />
                      {S.cancel}
                    </Button>
                  </div>
                </Panel>
              </Reveal>
            )}

            {/* ─── No duel: explainer + create ─── */}
            {!data.open && !data.active && (
              <Reveal>
                <Panel hud className="relative overflow-hidden p-5 sm:p-8">
                  <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-charge/15 blur-3xl" />
                  <div className="relative grid gap-8 lg:grid-cols-12 lg:items-center">
                    <div className="lg:col-span-7">
                      <Eyebrow tone="charge">{S.heroEyebrow}</Eyebrow>
                      <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                        {S.heroTitle}
                      </h2>
                      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2 sm:text-base">{S.heroBody}</p>
                      <div className="mt-6">
                        <Button variant="charge" size="lg" loading={busy} onClick={create}>
                          <Icon name="bolt" size={16} />
                          {busy ? S.creating : S.create}
                        </Button>
                      </div>
                    </div>
                    <ul className="v-stagger grid gap-3 lg:col-span-5">
                      {(
                        [
                          ['clock', S.point1Title, S.point1Body],
                          ['wallet', S.point2Title, S.point2Body],
                          ['share', S.point3Title, S.point3Body],
                        ] as [IconName, string, string][]
                      ).map(([icon, title, body]) => (
                        <li key={title} className="v-inset flex gap-3 p-3.5">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand/30 bg-brand/10 text-brand-hi">
                            <Icon name={icon} size={16} />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-ink">{title}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{body}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Panel>
              </Reveal>
            )}

            {/* ─── History ─── */}
            <Reveal index={2}>
              <Panel className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-base font-bold text-ink">{S.historyTitle}</h3>
                  <Chip>{data.history.length}</Chip>
                </div>
                {data.history.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-3">{S.historyEmpty}</p>
                ) : (
                  <ul className="v-stagger mt-4 divide-y divide-line/15">
                    {data.history.map((d) => (
                      <HistoryRow key={d.id} duel={d} />
                    ))}
                  </ul>
                )}
              </Panel>
            </Reveal>
          </>
        )}
      </div>
    </AppShell>
  );
}

/* ───────────────────────── Active race ───────────────────────── */

function ActiveDuel({ duel }: { duel: DuelDto }) {
  const S = useSocial().DUELS;
  const meIsChallenger = duel.mine !== 'opponent';
  const me = meIsChallenger ? duel.challenger : (duel.opponent ?? duel.challenger);
  const them = meIsChallenger ? duel.opponent : duel.challenger;
  const myScore = meIsChallenger ? duel.liveScore.challenger : duel.liveScore.opponent;
  const theirScore = meIsChallenger ? duel.liveScore.opponent : duel.liveScore.challenger;
  const total = myScore + theirScore;
  const myShare = total > 0 ? (myScore / total) * 100 : 50;
  const state = myScore > theirScore ? 'lead' : myScore < theirScore ? 'trail' : 'tie';

  const windowMs = useMemo(() => {
    if (!duel.startsAt || !duel.endsAt) return 1;
    return Math.max(1, new Date(duel.endsAt).getTime() - new Date(duel.startsAt).getTime());
  }, [duel.startsAt, duel.endsAt]);
  const elapsed = duel.startsAt ? Math.min(windowMs, Date.now() - new Date(duel.startsAt).getTime()) : 0;

  return (
    <Panel hud tone={state === 'lead' ? 'charge' : state === 'trail' ? 'heat' : 'default'} className="v-scanlines p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Eyebrow tone="charge">{S.activeEyebrow}</Eyebrow>
          <h2 className="mt-1.5 font-display text-xl font-bold text-ink sm:text-2xl">{S.activeTitle}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone={state === 'lead' ? 'charge' : state === 'trail' ? 'heat' : 'default'} dot>
            {state === 'lead' ? S.leading : state === 'trail' ? S.trailing : S.tied}
          </Chip>
          <Chip>
            <Icon name="clock" size={12} />
            {S.endsIn} {untilLabel(duel.endsAt)}
          </Chip>
        </div>
      </div>

      <div className="mt-6 grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <SideTile side={me} label={S.you} score={myScore} tone="charge" />
        <div className="grid place-items-center">
          <span className="font-display text-2xl font-bold tracking-[0.3em] text-ink-3">{S.vs}</span>
        </div>
        <SideTile side={them} label={them?.name ?? S.opponentUnknown} score={theirScore} tone="brand" />
      </div>

      <div className="mt-6">
        <div className="mb-1.5 flex justify-between text-[11px] font-bold text-ink-3">
          <span className="v-num">{myShare.toFixed(0)}%</span>
          <span className="v-num">{(100 - myShare).toFixed(0)}%</span>
        </div>
        <Progress value={myShare} charge />
        <div className="v-trace mt-3" />
        <div className="mt-2 flex justify-between text-[11px] text-ink-3">
          <span>{S.mined}</span>
          <span className="v-num">{Math.round((elapsed / windowMs) * 100)}% of window</span>
        </div>
      </div>
    </Panel>
  );
}

function SideTile({
  side,
  label,
  score,
  tone,
}: {
  side: DuelSide | null;
  label: string;
  score: number;
  tone: 'charge' | 'brand';
}) {
  const S = useSocial().DUELS;
  const accent = tone === 'charge' ? 'text-charge' : 'text-brand-hi';
  return (
    <div className="v-inset flex items-center gap-4 p-4">
      <Gauge value={side?.gridStability ?? 0} size={84} stroke={8} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-ink">{label}</p>
        <p className="mt-0.5 text-[11px] text-ink-3">
          {S.rate} <span className={`v-num font-bold ${accent}`}>{side ? fmt(side.ratePerHour) : '—'}</span>
        </p>
        <div className={`v-num mt-2 text-2xl font-extrabold ${accent}`}>
          <AnimatedNumber value={score} decimals={2} />
        </div>
        <p className="text-[10px] uppercase tracking-wider text-ink-3">{S.mined}</p>
      </div>
    </div>
  );
}

/* ───────────────────────── History ───────────────────────── */

function HistoryRow({ duel }: { duel: DuelDto }) {
  const S = useSocial().DUELS;
  const meIsChallenger = duel.mine !== 'opponent';
  const meId = meIsChallenger ? duel.challenger.id : duel.opponent?.id;
  const them = meIsChallenger ? duel.opponent : duel.challenger;
  const myScore = meIsChallenger ? duel.liveScore.challenger : duel.liveScore.opponent;
  const theirScore = meIsChallenger ? duel.liveScore.opponent : duel.liveScore.challenger;

  let label: string = S.draw;
  let tone: 'ok' | 'heat' | 'default' = 'default';
  if (duel.status === 'EXPIRED') label = S.expired;
  else if (duel.status === 'CANCELLED') label = S.cancelled;
  else if (duel.status === 'SETTLED' && duel.winnerId) {
    const won = duel.winnerId === meId;
    label = won ? S.won : S.lost;
    tone = won ? 'ok' : 'heat';
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Chip tone={tone} className="w-20 justify-center">
        {label}
      </Chip>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">
          {S.vs} {them?.name ?? S.opponentUnknown}
        </p>
        <p className="text-[11px] text-ink-3">{new Date(duel.createdAt).toLocaleDateString()}</p>
      </div>
      {duel.status === 'SETTLED' && (
        <div className="text-right">
          <p className="v-num text-xs font-bold text-ink-2">
            {fmt(myScore)} <span className="text-ink-3">/</span> {fmt(theirScore)}
          </p>
          {duel.transferPoints ? (
            <p className={`v-num text-[11px] font-bold ${tone === 'ok' ? 'text-charge' : 'text-heat'}`}>
              {tone === 'ok' ? '+' : '−'}
              {S.transferred(fmt(duel.transferPoints))}
            </p>
          ) : null}
        </div>
      )}
    </li>
  );
}

function ShareLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="v-btn v-btn--ghost v-btn--sm">
      <Icon name="arrow-up-right" size={13} />
      {label}
    </a>
  );
}

function DuelsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
