'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  claimMining,
  getBoosters,
  getMiningHistory,
  getMiningStatus,
  getProfile,
  getToken,
  logout,
  type BoosterPlanDto,
  type LedgerEntryDto,
  type MiningHistory,
  type MiningStatus,
  type Profile,
} from '../../../lib/api';
import TasksSection from './tasks-section';
import { AppShell } from '../../../components/AppShell';
import { Coin3D } from '../../../components/Coin3D';
import { BnbLogo } from '../../../components/BnbLogo';
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
  Stat,
  type ChipTone,
  type IconName,
} from '../../../components/ui';
import { useMiningFX } from '../../../lib/use-mining-fx';
import { usePolling } from '../../../lib/use-polling';
import { GridEventBanner } from '../../../components/grid/GridEventBanner';
import { LiveGridMap } from '../../../components/grid/LiveGridMap';
import { GridPulse } from '../../../components/grid/GridPulse';
import { useS } from '../../../components/grid/strings';
import { StarterChecklist } from '../../../components/onboarding/StarterChecklist';
import { LoanerBanner } from '../../../components/onboarding/LoanerBanner';
import { RescueBanner } from '../../../components/rescue/RescueBanner';
import { StreakCard, StreakTierModal } from '../../../components/onboarding/StreakCard';
import type { StreakDto } from '../../../lib/api';
import { rigCardPath } from '../../../components/share/strings';

/** How often the live accrual counter repaints. 10fps reads as smooth. */
const TICK_MS = 100;
/** Background refresh so the server stays the source of truth. */
const REFRESH_MS = 15_000;

export default function DashboardClient() {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const { playMiningStrike, playClaimReward, playError } = useMiningFX();

  const [status, setStatus] = useState<MiningStatus | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<MiningHistory | null>(null);
  const [plans, setPlans] = useState<BoosterPlanDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [celebrate, setCelebrate] = useState<number | null>(null);
  /** Set only when a claim crosses a streak tier, so the modal fires once. */
  const [tierUnlocked, setTierUnlocked] = useState<StreakDto | null>(null);

  const toLogin = useCallback(() => {
    logout();
    router.replace(`/${locale}/login`);
  }, [router, locale]);

  // Returns the status it fetched so a claim can compare the streak tier
  // before and after without reading a stale closure.
  const load = useCallback(async (): Promise<MiningStatus | null> => {
    try {
      const [s, p, h] = await Promise.all([getMiningStatus(), getProfile(), getMiningHistory()]);
      setStatus(s);
      setProfile(p);
      setHistory(h);
      setError(null);
      return s;
    } catch (err) {
      // 401/403 means the session is gone or the account was blocked.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toLogin();
        return null;
      }
      setError(err instanceof ApiError ? err.message : t('offline'));
      return null;
    }
  }, [toLogin, t]);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/${locale}/login`);
      return;
    }
    load();
    // The plan rail is catalogue data — fetched once, and a failure here
    // must not blank the dashboard.
    getBoosters()
      .then((b) => setPlans(b.plans))
      .catch(() => setPlans([]));
  }, [load, router, locale]);

  // Paused while the tab is hidden — see usePolling.
  usePolling(load, REFRESH_MS);

  async function mine() {
    if (!status?.canClaim || claiming) return;
    playMiningStrike();
    setClaiming(true);
    // The tier this claim is paid at — compared against the refreshed value
    // below to decide whether the miner just climbed one.
    const bonusBefore = status.streak?.bonusPercent ?? 0;
    try {
      const res = await claimMining();
      playClaimReward();
      setCelebrate(res.earnedPoints);
      setTimeout(() => setCelebrate(null), 1700);

      // Optimistic update so the balance and status never lag the tap.
      setProfile((prev) => (prev ? { ...prev, pointsBalance: prev.pointsBalance + res.earnedPoints } : prev));
      setStatus((prev) =>
        prev ? { ...prev, pendingPoints: 0, canClaim: false, nextClaimAt: res.nextClaimAt } : prev,
      );

      const fresh = await load();
      const streak = fresh?.streak;
      if (streak && streak.bonusPercent > bonusBefore) setTierUnlocked(streak);
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : t('offline'));
    } finally {
      setClaiming(false);
    }
  }

  if (!status || !profile) {
    return (
      <AppShell locale={locale}>
        <DashboardSkeleton message={error} />
      </AppShell>
    );
  }

  const ready = status.canClaim && !claiming;

  return (
    <AppShell locale={locale} mine={{ onMine: mine, ready, claiming }}>
      {error && (
        <Notice tone="heat" className="mb-4" icon={<Icon name="flame" size={16} />}>
          {error}
        </Notice>
      )}

      <GridEventBanner className="mb-4" />

      {/* The launch ramp. Both vanish on their own once they are spent. */}
      <StarterChecklist onboarding={status.onboarding} locale={locale} className="mb-4" />
      <LoanerBanner locale={locale} className="mb-4" />

      {/* A rig in trouble outranks everything below it. The rate already has
          both efficiencies baked in, so dividing them back out gives what the
          throttle is eating without a second request. */}
      <RescueBanner
        telemetry={status.rig}
        lostPerHour={
          status.ratePerHour /
            Math.max(0.01, status.rig.thermalEfficiency * status.rig.powerEfficiency) -
          status.ratePerHour
        }
        locale={locale}
        referralCode={profile?.referralCode}
        className="mb-4"
      />

      {/* Scroll target for the checklist's "Mine now". Zero-height on purpose. */}
      <div id="mine" className="scroll-mt-24" aria-hidden />

      {/* Console row: mine panel + balance column. */}
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <MinePanel status={status} claiming={claiming} celebrate={celebrate} onMine={mine} ready={ready} />
        <BalanceColumn profile={profile} history={history} status={status} locale={locale} />
      </div>

      <StreakTierModal
        streak={tierUnlocked}
        open={tierUnlocked !== null}
        onClose={() => setTierUnlocked(null)}
      />

      {/* Quick actions. */}
      <div className="v-stagger mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <QuickAction href={`/${locale}/rig`} icon="rig" title={t('navRig')} body={t('openRig')} tone="brand" />
        <QuickAction href={`/${locale}/boosters`} icon="chip" title={t('plansTitle')} body={t('buyBoosters')} tone="brand" />
        <QuickAction href={`/${locale}/referrals`} icon="users" title={t('referrals')} body={t('viewReferrals')} tone="charge" />
        <QuickAction href={`/${locale}/withdraw`} icon="swap" title={t('navWithdraw')} body={`${t('minWithdrawal')} · 100 ${t('pointsShort')}`} tone="ok" />
      </div>

      {/* Stat strip. */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Reveal index={0}>
          <Stat
            label={t('totalEarnings')}
            value={<AnimatedNumber value={history?.lifetimeEarnedPoints ?? 0} decimals={2} />}
            hint={t('pointsShort')}
            icon={<Icon name="sparkle" size={16} />}
            tone="charge"
          />
        </Reveal>
        <Reveal index={1}>
          <Stat
            label={t('hashRate')}
            value={<AnimatedNumber value={status.ratePerHour} decimals={2} suffix=" /h" />}
            hint={t('ratePerHour')}
            icon={<Icon name="bolt" size={16} />}
            tone="brand"
          />
        </Reveal>
        <Reveal index={2}>
          <Stat
            label={t('stability')}
            value={<AnimatedNumber value={status.rig.gridStability} decimals={0} suffix="%" />}
            hint={t('partsRunning', { count: status.activeBoosters })}
            icon={<Icon name="gauge" size={16} />}
            tone={status.rig.gridStability >= 100 ? 'charge' : status.rig.gridStability >= 60 ? 'default' : 'heat'}
          />
        </Reveal>
        <Reveal index={3}>
          <Stat
            label={t('referrals')}
            value={<AnimatedNumber value={profile.referralCount} decimals={0} />}
            hint={`L${status.referralTier.level} · ×${status.referralTier.multiplier}`}
            icon={<Icon name="users" size={16} />}
          />
        </Reveal>
      </div>

      <RigStrip status={status} locale={locale} />

      <Reveal className="mt-4">
        <GridPulse />
      </Reveal>

      <Reveal className="mt-4">
        <LiveGridMap size="sm" locale={locale} />
      </Reveal>

      {plans.length > 0 && <PlansRail plans={plans} locale={locale} />}

      <TasksSection onClaimed={load} />

      <RecentActivity entries={history?.entries ?? []} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ReferralPanel profile={profile} locale={locale} />
        <LeaderboardBanner locale={locale} />
      </div>

      <Reveal className="mt-4">
        <Panel className="grid grid-cols-2 gap-4 p-5 lg:grid-cols-4">
          <Feature icon="bolt" title={t('f1t')} body={t('f1b')} />
          <Feature icon="clock" title={t('f2t')} body={t('f2b')} />
          <Feature icon="swap" title={t('f3t')} body={t('f3b')} />
          <Feature icon="shield" title={t('f4t')} body={t('f4b')} />
        </Panel>
      </Reveal>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={toLogin}
          className="inline-flex items-center gap-2 text-xs font-bold text-ink-3 transition hover:text-heat"
        >
          <Icon name="logout" size={14} />
          {t('signOut')}
        </button>
      </div>
    </AppShell>
  );
}

/* ───────────────────────── Mine console ───────────────────────── */

function MinePanel({
  status,
  claiming,
  celebrate,
  onMine,
  ready,
}: {
  status: MiningStatus;
  claiming: boolean;
  celebrate: number | null;
  onMine: () => void;
  ready: boolean;
}) {
  const t = useTranslations('dashboard');
  const pending = useLiveAccrual(status);
  const countdown = useCountdown(status.nextClaimAt);
  const progress = status.maxPendingPoints > 0 ? Math.min(1, pending / status.maxPendingPoints) : 0;
  const [shocks, setShocks] = useState<number[]>([]);

  // Every claim spawns a fresh ring; old ones fall away after they finish.
  useEffect(() => {
    if (celebrate === null) return;
    const id = Date.now();
    setShocks((s) => [...s, id]);
    const timer = setTimeout(() => setShocks((s) => s.filter((x) => x !== id)), 1000);
    return () => clearTimeout(timer);
  }, [celebrate]);

  return (
    <Panel
      tone={ready ? 'charge' : 'default'}
      hud
      className="v-scanlines relative overflow-hidden p-5 animate-rise sm:p-7"
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
      {ready && <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-charge/15 blur-3xl" />}

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow tone={ready ? 'charge' : 'brand'}>{t('cloudMining')}</Eyebrow>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{t('title')}</h1>
          <p className="mt-1.5 max-w-sm text-sm text-ink-2">{t('heroBody')}</p>
        </div>
        <Chip tone="brand" className="shrink-0">
          <BnbLogo className="h-3 w-3" />
          {t('bnbRewards')}
        </Chip>
      </div>

      <div className="relative mt-4 grid items-center gap-4 sm:grid-cols-[auto_1fr]">
        {/* The coin, small on phones. */}
        <div className="hidden w-52 sm:block">
          <Coin3D size="sm" />
        </div>

        <div className="text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            {ready ? (
              <Chip tone="charge" dot>
                {t('ready')}
              </Chip>
            ) : (
              <Chip tone="brand" dot>
                {t('accruing')}
              </Chip>
            )}
          </div>

          <div className="relative mt-3">
            {celebrate !== null && (
              <span className="v-float-up text-2xl sm:hidden">+{celebrate.toFixed(2)} {t('pointsShort')}</span>
            )}
            <div className={`v-num text-5xl font-extrabold leading-none tracking-tight sm:text-6xl ${ready ? 'text-charge' : 'text-ink'}`}>
              {pending.toFixed(4)}
            </div>
            <div className="mt-1.5 text-sm text-ink-3">{t('pending')}</div>
          </div>

          <Progress value={progress * 100} charge={ready} className="mt-4 max-w-xs mx-auto sm:mx-0" />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Chip tone="brand">
              <Icon name="bolt" size={12} />
              <span className="v-num">{status.ratePerHour}</span> /h
            </Chip>
            {!status.canClaim && countdown && (
              <Chip>
                <Icon name="clock" size={12} />
                <span className="v-num">{countdown}</span>
              </Chip>
            )}
            <Chip tone={status.rig.gridStability >= 100 ? 'charge' : status.rig.gridStability >= 60 ? 'warn' : 'heat'}>
              <Icon name="gauge" size={12} />
              <span className="v-num">{status.rig.gridStability}%</span>
            </Chip>
          </div>
        </div>
      </div>

      {/* The mine button: a big circle, lime only when ready. */}
      <div className="relative mt-6 flex justify-center sm:justify-end">
        <div className="relative grid place-items-center">
          {shocks.map((id) => (
            <span key={id} className="v-shock" style={{ borderColor: 'rgb(var(--c-charge))' }} />
          ))}
          {shocks.map((id) => (
            <span key={`b-${id}`} className="v-shock" style={{ animationDelay: '120ms', borderColor: 'rgb(var(--c-brand-hi))' }} />
          ))}
          {celebrate !== null && (
            <span className="v-float-up -top-6 hidden text-xl sm:block">+{celebrate.toFixed(2)} {t('pointsShort')}</span>
          )}
          <button
            type="button"
            onClick={onMine}
            disabled={!ready}
            aria-label={t('mineButton')}
            className={`relative grid h-32 w-32 place-items-center rounded-full font-display text-sm font-bold uppercase tracking-[0.2em] transition-all duration-300 active:scale-95 ${
              ready
                ? 'v-btn v-btn--charge !rounded-full shadow-charge'
                : 'border border-line/25 bg-surface-2/70 text-ink-3 disabled:opacity-70'
            }`}
          >
            <span className="flex flex-col items-center gap-1">
              {claiming ? (
                <span className="inline-block h-7 w-7 animate-spin rounded-full border-[3px] border-current border-t-transparent" />
              ) : (
                <Icon name="bolt" size={30} strokeWidth={2.4} className={ready ? 'animate-breathe' : ''} />
              )}
              <span className="text-[11px]">{t('mineButton')}</span>
            </span>
          </button>
        </div>
      </div>
    </Panel>
  );
}

function BalanceColumn({
  profile,
  history,
  status,
  locale,
}: {
  profile: Profile;
  history: MiningHistory | null;
  status: MiningStatus;
  locale: string;
}) {
  const t = useTranslations('dashboard');
  // SPEC §3: 3 points = 1 mainnet $VLTR.
  const token = profile.pointsBalance / 3;
  const kycOk = profile.kycStatus === 'APPROVED';

  return (
    <div className="flex flex-col gap-4">
      <StreakCard streak={status.streak} />

      <Panel hud className="relative overflow-hidden p-5 animate-rise sm:p-6" style={{ animationDelay: '80ms' }}>
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-charge/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <Eyebrow>{t('balance')}</Eyebrow>
            <div className="mt-2 flex items-baseline gap-2">
              <AnimatedNumber value={profile.pointsBalance} decimals={2} className="text-4xl font-extrabold text-ink sm:text-5xl" />
              <span className="text-sm font-extrabold text-charge">{t('pointsShort')}</span>
            </div>
            <div className="mt-1.5 text-sm text-ink-2">
              ≈ <AnimatedNumber value={token} decimals={4} className="font-extrabold text-brand-hi" /> $VLTR
              <span className="ml-1 text-xs text-ink-3">({t('atRate')})</span>
            </div>
          </div>
          <Gauge value={status.rig.gridStability} size={92} stroke={8} />
        </div>

        <div className="v-divider my-4" />

        {/* Nothing to nag about while verification is not being collected —
            KYC gates only the withdrawal path, which is shut anyway. */}
        {kycOk ? (
          <Notice tone="ok" icon={<Icon name="shield" size={16} />}>
            {t('kycVerified')}
          </Notice>
        ) : !profile.kycOpen ? null : (
          <Link href={`/${locale}/kyc`} className="block">
            <Notice tone="warn" icon={<Icon name="shield" size={16} />}>
              <span className="block">{t('kycRequired', { status: profile.kycStatus })}</span>
              <span className="mt-1 inline-flex items-center gap-1 font-extrabold">
                {t('verifyCta')} <Icon name="arrow-up-right" size={12} />
              </span>
            </Notice>
          </Link>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Mini label={t('minWithdrawal')} value={`100`} unit={t('pointsShort')} />
          <Mini label={t('boosters')} value={String(status.activeBoosters)} unit="" />
          <Mini label={t('referralTier')} value={`L${status.referralTier.level}`} unit={`×${status.referralTier.multiplier}`} />
        </div>
      </Panel>

      <Panel className="flex items-center justify-between gap-3 p-4 animate-rise" style={{ animationDelay: '160ms' }}>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand-hi">
            <Icon name="wallet" size={18} />
          </span>
          <div>
            <div className="text-sm font-extrabold text-ink">{t('chainIndicator')}</div>
            <div className="text-xs text-ink-3">{t('poweredByBnb')}</div>
          </div>
        </div>
        <Chip tone="ok" dot>
          {t('totalEarnings')} <span className="v-num">{(history?.lifetimeEarnedPoints ?? 0).toFixed(1)}</span>
        </Chip>
      </Panel>
    </div>
  );
}

function Mini({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="v-inset p-3">
      <div className="truncate text-[10px] font-bold uppercase tracking-wider text-ink-3">{label}</div>
      <div className="v-num mt-1 text-base font-extrabold text-ink">
        {value} <span className="text-[10px] text-ink-3">{unit}</span>
      </div>
    </div>
  );
}

/* ───────────────────────── Quick actions ──────────────────────── */

function QuickAction({
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
  tone: 'brand' | 'charge' | 'ok';
}) {
  const color = tone === 'charge' ? 'bg-charge/10 text-charge' : tone === 'ok' ? 'bg-ok/10 text-ok' : 'bg-brand/12 text-brand-hi';
  return (
    <Link href={href} className="block">
      <Panel lift trace hud className="group flex h-full flex-col justify-between p-4 sm:p-5">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${color}`}>
          <Icon name={icon} size={18} />
        </span>
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-extrabold text-ink">{title}</span>
            <Icon name="chevron-right" size={14} className="text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-charge" />
          </div>
          <div className="mt-0.5 truncate text-xs text-ink-3">{body}</div>
        </div>
      </Panel>
    </Link>
  );
}

/* ───────────────────────── Rig telemetry ──────────────────────── */

/**
 * The rig, condensed to one row. Its job is to make a throttle impossible
 * to miss: an overheating rig quietly pays less every hour.
 */
function RigStrip({ status, locale }: { status: MiningStatus; locale: string }) {
  const GRID_S = useS();
  const t = useTranslations('dashboard');
  const rig = status.rig;
  const throttled = rig.overheating || rig.brownout;
  const overclock = !!rig.modifiers?.overclock;

  return (
    <Reveal className="mt-4">
      <Panel tone={throttled || overclock ? 'heat' : 'default'} hud className="v-scanlines relative overflow-hidden p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow tone={throttled ? 'default' : 'brand'}>{t('rigTitle')}</Eyebrow>
              {overclock && (
                <Chip tone="heat" dot>
                  {GRID_S.overclock.on}
                </Chip>
              )}
              {(rig.disabledCount ?? 0) > 0 && (
                <Chip tone="heat">
                  <span className="v-num">{rig.disabledCount}</span> {GRID_S.parts.burned.toLowerCase()}
                </Chip>
              )}
            </div>
            <p className={`mt-1 text-sm ${throttled ? 'text-heat' : 'text-ink-2'}`}>
              {throttled ? t('rigThrottled') : t('rigStable')}
            </p>
          </div>
          <Link href={`/${locale}/rig`} className="v-btn v-btn--primary v-btn--sm shrink-0">
            {t('openRig')} <Icon name="chevron-right" size={12} />
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <RigMeter label={t('thermal')} used={rig.heatLoad} capacity={rig.coolingCapacity} unit="TU" bad={rig.overheating} icon="flame" />
          <RigMeter label={t('power')} used={rig.powerDraw} capacity={rig.powerSupply} unit="W" bad={rig.brownout} icon="plug" />
          <div className="v-inset p-3">
            <div className="flex items-center justify-between">
              <span className="v-eyebrow">{t('slotsUsed')}</span>
              <Icon name="chip" size={14} className="text-brand-hi" />
            </div>
            <p className="v-num mt-1 text-xl font-extrabold text-ink">{rig.installedCount}</p>
            <p className="mt-0.5 text-[11px] text-ink-3">{t('hashTotal', { amount: rig.hashPerHour.toFixed(1) })}</p>
          </div>
        </div>
        {!throttled && <div className="v-trace mt-4" />}
      </Panel>
    </Reveal>
  );
}

function RigMeter({
  label,
  used,
  capacity,
  unit,
  bad,
  icon,
}: {
  label: string;
  used: number;
  capacity: number;
  unit: string;
  bad: boolean;
  icon: IconName;
}) {
  const pct = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;
  return (
    <div className="v-inset p-3">
      <div className="flex items-center justify-between">
        <span className="v-eyebrow flex items-center gap-1.5">
          <Icon name={icon} size={12} className={bad ? 'text-heat' : 'text-brand-hi'} />
          {label}
        </span>
        <span className={`v-num text-xs font-bold ${bad ? 'text-heat' : 'text-ink-2'}`}>
          {used} / {capacity} {unit}
        </span>
      </div>
      <div className="stability-track mt-2 h-1.5">
        <div
          className={`stability-fill ${bad ? 'stability-fill--critical' : pct > 80 ? 'stability-fill--warn' : ''}`}
          style={{ width: `${bad ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
}

/* ───────────────────────── Plans rail ─────────────────────────── */

const KIND_STRIPE: Record<BoosterPlanDto['kind'], string> = {
  CORE: 'rig-slot__kind--core',
  COOLER: 'rig-slot__kind--cooler',
  PSU: 'rig-slot__kind--psu',
  MODULE: 'rig-slot__kind--module',
};

const KIND_ICON: Record<BoosterPlanDto['kind'], IconName> = {
  CORE: 'chip',
  COOLER: 'snow',
  PSU: 'plug',
  MODULE: 'sparkle',
};

function PlansRail({ plans, locale }: { plans: BoosterPlanDto[]; locale: string }) {
  const t = useTranslations('dashboard');
  return (
    <Reveal className="mt-4">
      <Panel className="p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Eyebrow tone="brand">{t('plansTitle')}</Eyebrow>
            <p className="mt-1 text-sm text-ink-2">{t('plansSubtitle')}</p>
          </div>
          <Link href={`/${locale}/boosters`} className="inline-flex shrink-0 items-center gap-1 text-xs font-extrabold text-brand-hi hover:text-ink">
            {t('viewAll')} <Icon name="chevron-right" size={12} />
          </Link>
        </div>

        <div className="v-stagger -mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {plans.map((p, i) => (
            <PlanCard key={p.id} plan={p} popular={i === 1} href={`/${locale}/boosters`} />
          ))}
        </div>
      </Panel>
    </Reveal>
  );
}

function PlanCard({ plan, popular, href }: { plan: BoosterPlanDto; popular: boolean; href: string }) {
  const t = useTranslations('dashboard');
  const stat = (label: string, value: string, hot = false) => (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ink-3">{label}</span>
      <span className={`v-num font-extrabold ${hot ? 'text-heat' : 'text-ink'}`}>{value}</span>
    </div>
  );
  return (
    <Link href={href} className="w-[78%] shrink-0 snap-start sm:w-auto">
      <Panel lift trace className={`relative flex h-full flex-col justify-between overflow-hidden p-4 ${popular ? 'border-charge/40' : ''}`}>
        <span className={`rig-slot__kind ${KIND_STRIPE[plan.kind]}`} />
        {popular && (
          <span className="absolute right-3 top-3">
            <Chip tone="charge">{t('popular')}</Chip>
          </span>
        )}
        <div className="pl-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand-hi">
            <Icon name={KIND_ICON[plan.kind]} size={16} />
          </span>
          <div className="mt-3 text-sm font-extrabold text-ink">{plan.name}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="v-num text-2xl font-extrabold text-charge">${plan.priceUsd}</span>
            <span className="text-[10px] font-bold uppercase text-ink-3">
              / {plan.durationDays} {t('days')}
            </span>
          </div>
          <div className="mt-3 space-y-1.5 border-t border-line/15 pt-3">
            {plan.rateBonusPerHour > 0 && stat(t('hashRate'), `+${plan.rateBonusPerHour} /h`)}
            {plan.hashBoostPercent > 0 && stat(t('hashRate'), `+${plan.hashBoostPercent}%`)}
            {plan.cooling > 0 && stat(t('thermal'), `+${plan.cooling} TU`)}
            {plan.wattsSupplied > 0 && stat(t('power'), `+${plan.wattsSupplied} W`)}
            {plan.heat > 0 && stat(t('thermal'), `${plan.heat} TU`, true)}
            {plan.watts > 0 && stat(t('power'), `${plan.watts} W`, true)}
            {/* The miner owns a rig here, so quote THEIR rate. The
                stock-chassis figure overstates a big core badly — a VC-50 on
                a bare chassis makes 3.59/h, not the 90.9 it advertises. */}
            {plan.fit
              ? stat(
                  t('resultingRate'),
                  `${plan.fit.ratePerHourBefore.toFixed(2)} → ${plan.fit.ratePerHourAfter.toFixed(2)} /h`,
                )
              : stat(t('resultingRate'), `${plan.resultingRatePerHour} /h`)}
            {plan.fit && !plan.fit.clean && plan.fit.fix
              ? stat(
                  t('resultingRate'),
                  `+${plan.fit.fix.steps.map((s) => s.code).join('+')} $${plan.fit.fix.totalUsd} → ${plan.fit.fix.ratePerHour.toFixed(2)} /h`,
                )
              : null}
          </div>
        </div>
        <span className="v-btn v-btn--primary v-btn--sm mt-4 w-full">
          {t('getStarted')} <Icon name="chevron-right" size={12} />
        </span>
      </Panel>
    </Link>
  );
}

function Feature({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="text-center">
      <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand-hi">
        <Icon name={icon} size={18} />
      </span>
      <div className="mt-2 text-sm font-extrabold text-ink">{title}</div>
      <div className="mt-0.5 text-xs text-ink-3">{body}</div>
    </div>
  );
}

/* ──────────────────────── Recent activity ─────────────────────── */

const REASON_TONE: Record<LedgerEntryDto['reason'], ChipTone> = {
  MINING: 'brand',
  TASK_REWARD: 'ok',
  REFERRAL_BONUS: 'charge',
  BOOSTER_PURCHASE: 'brand',
  WITHDRAWAL: 'warn',
  AIRDROP: 'charge',
  ADMIN_ADJUST: 'default',
};

const REASON_ICON: Record<LedgerEntryDto['reason'], IconName> = {
  MINING: 'bolt',
  TASK_REWARD: 'gift',
  REFERRAL_BONUS: 'users',
  BOOSTER_PURCHASE: 'chip',
  WITHDRAWAL: 'swap',
  AIRDROP: 'sparkle',
  ADMIN_ADJUST: 'settings',
};

function RecentActivity({ entries }: { entries: LedgerEntryDto[] }) {
  const t = useTranslations('dashboard');
  if (!entries.length) return null;

  return (
    <Reveal className="mt-4">
      <Panel className="p-5">
        <Eyebrow tone="brand">{t('recentTitle')}</Eyebrow>
        <ul className="v-stagger mt-3 divide-y divide-line/10">
          {entries.map((e) => {
            const tone = REASON_TONE[e.reason] ?? 'default';
            return (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <Chip tone={tone} className="!h-9 !w-9 justify-center !p-0">
                  <Icon name={REASON_ICON[e.reason] ?? 'bolt'} size={14} />
                </Chip>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink">{t(`reason.${e.reason}`)}</div>
                  <div className="text-xs text-ink-3">{new Date(e.createdAt).toLocaleString()}</div>
                </div>
                <span className={`v-num shrink-0 text-sm font-extrabold ${e.points >= 0 ? 'text-ok' : 'text-warn'}`}>
                  {e.points >= 0 ? '+' : ''}
                  {e.points.toFixed(2)}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </Reveal>
  );
}

/* ───────────────────────── Referral panel ─────────────────────── */

function ReferralPanel({ profile, locale }: { profile: Profile; locale: string }) {
  const t = useTranslations('dashboard');
  const { playTick } = useMiningFX();
  const [copied, setCopied] = useState(false);
  // The rig card, not a bare invite: this link unfurls into an image of the
  // miner's own build. `?ref=` still rides on the card page's sign-up CTA.
  const link =
    typeof window !== 'undefined'
      ? `${window.location.origin}${rigCardPath(locale, profile.referralCode)}`
      : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      playTick();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is still selectable */
    }
  }

  return (
    <Reveal>
      <Panel hud className="relative h-full overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-charge/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-charge/10 text-charge">
              <Icon name="users" size={16} />
            </span>
            <Eyebrow>{t('referralLink')}</Eyebrow>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone="charge">
              L{profile.referralTier.level} · ×{profile.referralTier.multiplier}
            </Chip>
            <Chip>
              <span className="v-num">{profile.referralCode}</span>
            </Chip>
          </div>
        </div>

        <div className="relative mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="v-inset min-w-0 flex-1 px-3.5 py-3">
            <code className="block select-all truncate font-mono text-sm font-bold text-charge">
              {link || `...${rigCardPath(locale, profile.referralCode)}`}
            </code>
          </div>
          <Button variant={copied ? 'ghost' : 'charge'} onClick={copy} className="shrink-0">
            <Icon name={copied ? 'check' : 'copy'} size={14} />
            {copied ? t('copied') : t('copy')}
          </Button>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/15 pt-3.5">
          <div className="text-xs text-ink-2">
            {t('referrals')}: <strong className="v-num text-ink">{profile.referralCount}</strong>
          </div>
          <Link href={`/${locale}/referrals`} className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-hi hover:text-ink">
            {t('viewReferrals')} <Icon name="chevron-right" size={12} />
          </Link>
        </div>
      </Panel>
    </Reveal>
  );
}

function LeaderboardBanner({ locale }: { locale: string }) {
  const t = useTranslations('leaderboard');
  return (
    <Reveal index={1}>
      <Link href={`/${locale}/leaderboard`} className="block h-full">
        <Panel lift trace className="group flex h-full items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ok/10 text-ok">
              <Icon name="trophy" size={20} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold text-ink">{t('title')}</div>
              <div className="truncate text-xs text-ink-3">
                {t('yourRank')} · {t('catEarnings')}
              </div>
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-charge" />
        </Panel>
      </Link>
    </Reveal>
  );
}

/* ───────────────────────── Skeleton ───────────────────────────── */

function DashboardSkeleton({ message }: { message: string | null }) {
  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Skeleton className="h-80 w-full rounded-2xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      {message && (
        <Notice tone="heat" className="mt-6">
          {message}
        </Notice>
      )}
    </div>
  );
}

/* ───────────────────────────── Hooks ──────────────────────────── */

function useLiveAccrual(status: MiningStatus): number {
  const [pending, setPending] = useState(status.pendingPoints);
  const anchor = useRef({ at: 0, base: status.pendingPoints });

  useEffect(() => {
    anchor.current = { at: Date.now(), base: status.pendingPoints };
    setPending(status.pendingPoints);
  }, [status.pendingPoints]);

  useEffect(() => {
    const perMs = status.ratePerHour / 3_600_000;
    const cap = status.maxPendingPoints;
    const id = setInterval(() => {
      const { at, base } = anchor.current;
      setPending(Math.min(cap, base + (Date.now() - at) * perMs));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [status.ratePerHour, status.maxPendingPoints]);

  return pending;
}

function useCountdown(iso: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!iso) {
      setLabel(null);
      return;
    }
    const target = new Date(iso).getTime();
    const render = () => {
      const ms = target - Date.now();
      if (ms <= 0) return setLabel(null);
      const s = Math.floor(ms / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setLabel(`${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`);
    };
    render();
    const id = setInterval(render, 1000);
    return () => clearInterval(id);
  }, [iso]);

  return label;
}
