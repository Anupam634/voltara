'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  getPayoutWindow,
  getProfile,
  getToken,
  getWithdrawals,
  requestWithdrawal,
  WITHDRAWAL_COOLDOWN_DAYS,
  WITHDRAWAL_MIN_POINTS,
  type PayoutWindowDto,
  type Profile,
  type WithdrawalDto,
} from '../../../lib/api';
import { AppShell } from '../../../components/AppShell';
import { BnbBadge, BnbLogo } from '../../../components/BnbLogo';
import {
  AnimatedNumber,
  Button,
  Chip,
  Eyebrow,
  Field,
  Icon,
  Input,
  Notice,
  Panel,
  Reveal,
  Skeleton,
  type ChipTone,
} from '../../../components/ui';
import { useMiningFX } from '../../../lib/use-mining-fx';

/** SPEC §3: 3 points = 1 mainnet $VLTR. */
const POINTS_PER_TOKEN = 3;

/** Loose shape check only — the server validates the address for real. */
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const STATUS_TONE: Record<WithdrawalDto['status'], ChipTone> = {
  PAID: 'ok',
  APPROVED: 'brand',
  PENDING: 'warn',
  REJECTED: 'heat',
};

export default function WithdrawClient() {
  const t = useTranslations('withdraw');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<WithdrawalDto[] | null>(null);
  const [payoutWindow, setPayoutWindow] = useState<PayoutWindowDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, h, w] = await Promise.all([
        getProfile(),
        getWithdrawals(),
        getPayoutWindow(),
      ]);
      setProfile(p);
      setHistory(h);
      setPayoutWindow(w);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.replace(`/${locale}/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : t('offline'));
    }
  }, [router, locale, t]);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/${locale}/login`);
      return;
    }
    load();
  }, [load, router, locale]);

  return (
    <AppShell
      locale={locale}
      backLabel={t('backToDashboard')}
      width="max-w-4xl"
      eyebrow="Payout"
      title={t('title')}
      subtitle={t('subtitle')}
      actions={<BnbBadge label={t('paidOnChain')} />}
    >
      {error && (
        <Notice tone="heat" icon={<Icon name="x" size={16} />} className="mb-5">
          {error}
        </Notice>
      )}

      {!profile || !history || !payoutWindow ? (
        <div className="space-y-4">
          <Panel className="p-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-12 w-56" />
            <Skeleton className="mt-6 h-12 w-full" />
            <Skeleton className="mt-3 h-12 w-full" />
          </Panel>
        </div>
      ) : (
        <div className="space-y-4">
          <RequestForm
            profile={profile}
            history={history}
            locale={locale}
            payoutWindow={payoutWindow}
            onDone={load}
          />
          <History rows={history} />
        </div>
      )}
    </AppShell>
  );
}

/* ─────────────────────────── Request form ────────────────────────── */

function RequestForm({
  profile,
  history,
  locale,
  payoutWindow,
  onDone,
}: {
  profile: Profile;
  history: WithdrawalDto[];
  locale: string;
  payoutWindow: PayoutWindowDto;
  onDone: () => void;
}) {
  const t = useTranslations('withdraw');
  const { playError, playClaimReward } = useMiningFX();
  const [points, setPoints] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const balance = profile.pointsBalance;

  // The server allows one request per rolling week; work out when the last
  // one frees up so the form can say so instead of failing on submit.
  const cooldownUntil = useMemo(() => {
    const last = history[0];
    if (!last) return null;
    const free = new Date(last.requestedAt).getTime() + WITHDRAWAL_COOLDOWN_DAYS * 24 * 3_600_000;
    return free > Date.now() ? new Date(free) : null;
  }, [history]);

  // Payouts are closed until $VLTR launches. This outranks every other gate:
  // the rest are things a miner can fix today, this one is a date.
  const payoutsClosed = !payoutWindow.open;
  const opensOn = payoutWindow.opensAt
    ? new Date(payoutWindow.opensAt).toLocaleDateString()
    : null;

  const kycOk = profile.kycStatus === 'APPROVED';
  const enoughBalance = balance >= WITHDRAWAL_MIN_POINTS;
  const blocked =
    payoutsClosed || !kycOk || !enoughBalance || cooldownUntil !== null;
  const eligible = !blocked;

  const amount = Number(points);
  const amountValid = Number.isFinite(amount) && amount >= WITHDRAWAL_MIN_POINTS && amount <= balance;
  const amountTouched = points.trim().length > 0;
  const addressTrim = toAddress.trim();
  const addressValid = ADDRESS_RE.test(addressTrim);
  const addressTouched = addressTrim.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestWithdrawal(amount, addressTrim);
      playClaimReward();
      setPoints('');
      setToAddress('');
      setDone(true);
      onDone();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : t('offline'));
    } finally {
      setBusy(false);
    }
  }

  // Closed window: no form at all. A disabled form still reads as "nearly",
  // and the honest answer is a date. The balance stays on screen because it
  // is the thing that keeps growing while the window is shut.
  if (payoutsClosed) {
    return (
      <Reveal index={0}>
        <Panel hud className="p-5 sm:p-7">
          <BalanceHeader balance={balance} eligible={false} />
          <div className="v-divider mt-4" />
          <Notice tone="brand" icon={<Icon name="clock" size={16} />} className="mt-4">
            <span className="block font-bold text-ink">{t('closedTitle')}</span>
            <span className="mt-1 block">
              {opensOn ? t('closedOn', { date: opensOn }) : t('closedBody')}
            </span>
          </Notice>
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            {t('closedKeepMining')}
          </p>
        </Panel>
      </Reveal>
    );
  }

  return (
    <Reveal index={0}>
      <Panel hud tone={eligible ? 'charge' : 'default'} className="p-5 sm:p-7">
        <BalanceHeader balance={balance} eligible={eligible} />

        {eligible && <div className="v-trace mt-4" />}
        {!eligible && <div className="v-divider mt-4" />}

        {/* Gates, most blocking first. The payouts-closed notice above already
            explains why nothing can be withdrawn; pushing someone toward a
            verification form that refuses them adds a second dead end. */}
        {!kycOk && profile.kycOpen && (
          <Link href={`/${locale}/kyc`} className="mt-4 block">
            <Notice tone="warn" icon={<Icon name="shield" size={16} />} className="transition hover:border-warn/70">
              <span className="flex items-center justify-between gap-3">
                <span>{t('kycRequired')}</span>
                <span className="inline-flex shrink-0 items-center gap-1 font-bold">
                  {t('verifyCta')}
                  <Icon name="chevron-right" size={14} />
                </span>
              </span>
            </Notice>
          </Link>
        )}
        {kycOk && !enoughBalance && (
          <Notice tone="default" icon={<Icon name="wallet" size={16} />} className="mt-4">
            {t('needMore', { min: WITHDRAWAL_MIN_POINTS })}
          </Notice>
        )}
        {kycOk && enoughBalance && cooldownUntil && (
          <Notice tone="brand" icon={<Icon name="clock" size={16} />} className="mt-4">
            {t('cooldown', { date: cooldownUntil.toLocaleDateString() })}
          </Notice>
        )}

        {done && (
          <Notice tone="ok" icon={<Icon name="check" size={16} />} className="mt-4 animate-pop">
            {t('submitted')}
          </Notice>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <Field
            label={`${t('amount')} (${t('pointsShort')})`}
            error={amountTouched && !amountValid ? t('minNote', { min: WITHDRAWAL_MIN_POINTS }) : undefined}
            hint={
              <span className="flex items-center justify-between gap-3">
                <span>{t('minNote', { min: WITHDRAWAL_MIN_POINTS })}</span>
                <button
                  type="button"
                  onClick={() => setPoints(String(Math.floor(balance * 100) / 100))}
                  disabled={blocked || busy}
                  className="v-btn v-btn--ghost v-btn--sm py-1"
                >
                  {t('useMax')}
                </button>
              </span>
            }
          >
            <Input
              className="v-num text-lg font-bold"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              disabled={blocked || busy}
              inputMode="decimal"
              placeholder={String(WITHDRAWAL_MIN_POINTS)}
              error={amountTouched && !amountValid}
            />
          </Field>

          <Field
            label={t('toAddress')}
            hint={
              addressTouched && addressValid ? (
                <span className="inline-flex items-center gap-1 text-ok">
                  <Icon name="check" size={12} /> {t('addressNote')}
                </span>
              ) : (
                t('addressNote')
              )
            }
            error={addressTouched && !addressValid ? 'Enter a valid 0x… BNB Chain address (42 characters).' : undefined}
          >
            <Input
              className="v-num text-xs"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              disabled={blocked || busy}
              placeholder="0x…"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              error={addressTouched && !addressValid}
            />
          </Field>

          {/* What actually lands in the wallet, before they commit. */}
          <div
            className={`v-inset flex flex-wrap items-center justify-between gap-2 p-4 transition ${
              amountValid ? 'opacity-100' : 'opacity-50'
            }`}
          >
            <span className="text-sm text-ink-2">{t('youReceive')}</span>
            <span className="flex items-baseline gap-2">
              <span className="v-num text-2xl font-extrabold text-charge">
                {(amountValid ? amount / POINTS_PER_TOKEN : 0).toFixed(4)}
              </span>
              <span className="text-sm font-bold text-ink">$VLTR</span>
            </span>
            <span className="w-full text-[11px] text-ink-3">{t('conversionNote')}</span>
          </div>

          {error && (
            <Notice tone="heat" icon={<Icon name="x" size={16} />}>
              {error}
            </Notice>
          )}

          <Button
            type="submit"
            variant={eligible && amountValid && addressValid ? 'charge' : 'primary'}
            size="lg"
            loading={busy}
            disabled={blocked || !amountValid || !addressValid}
            className="w-full"
          >
            {busy ? (
              <span>{t('submitting')}</span>
            ) : (
              <>
                <Icon name="swap" size={16} />
                <span>{t('submit')}</span>
              </>
            )}
          </Button>

          <p className="text-xs leading-relaxed text-ink-3">{t('reviewNote')}</p>
        </form>
      </Panel>
    </Reveal>
  );
}

/** What is actually withdrawable right now, and what it converts to. */
function BalanceHeader({ balance, eligible }: { balance: number; eligible: boolean }) {
  const t = useTranslations('withdraw');

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Eyebrow tone={eligible ? 'charge' : 'default'}>{t('available')}</Eyebrow>
        <div className="mt-2 flex items-baseline gap-2">
          <AnimatedNumber
            value={balance}
            decimals={2}
            className={`text-4xl font-extrabold sm:text-5xl ${eligible ? 'text-charge' : 'text-ink'}`}
          />
          <span className="text-sm font-bold text-ink-2">{t('pointsShort')}</span>
        </div>
      </div>
      <div className="v-inset flex items-center gap-2 px-3 py-2 text-sm">
        <BnbLogo className="h-3.5 w-3.5 text-warn" />
        <span className="text-ink-3">≈</span>
        <AnimatedNumber value={balance / POINTS_PER_TOKEN} decimals={4} className="font-bold text-brand-hi" />
        <span className="text-ink-2">$VLTR</span>
      </div>
    </div>
  );
}

/* ───────────────────────────── History ───────────────────────────── */

function History({ rows }: { rows: WithdrawalDto[] }) {
  const t = useTranslations('withdraw');
  if (rows.length === 0) return null;

  return (
    <Reveal index={1}>
      <Panel hud className="p-5 sm:p-6">
        <Eyebrow>{t('historyTitle')}</Eyebrow>
        <div className="-mx-5 mt-4 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="v-eyebrow border-b border-line/20">
                <th className="pb-2.5 pr-4 font-bold">{t('amount')}</th>
                <th className="pb-2.5 pr-4 font-bold">$VLTR</th>
                <th className="pb-2.5 pr-4 font-bold">{t('toAddress')}</th>
                <th className="pb-2.5 pr-4 font-bold">Date</th>
                <th className="pb-2.5 text-right font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="v-stagger divide-y divide-line/10">
              {rows.map((w) => (
                <tr key={w.id} className="align-top">
                  <td className="v-num py-3 pr-4 font-bold text-ink">
                    {w.points.toFixed(2)} <span className="text-xs font-semibold text-ink-3">{t('pointsShort')}</span>
                  </td>
                  <td className="v-num py-3 pr-4 font-bold text-brand-hi">{w.tokenAmount}</td>
                  <td className="py-3 pr-4">
                    <span className="v-num block max-w-[12rem] truncate text-xs text-ink-2" title={w.toAddress}>
                      {w.toAddress}
                    </span>
                    {w.txHash && (
                      <span className="v-num mt-0.5 block max-w-[12rem] truncate text-[10px] text-ink-3" title={w.txHash}>
                        tx {w.txHash}
                      </span>
                    )}
                  </td>
                  <td className="v-num py-3 pr-4 text-xs text-ink-2">{new Date(w.requestedAt).toLocaleString()}</td>
                  <td className="py-3 text-right">
                    <Chip tone={STATUS_TONE[w.status]} dot={w.status === 'PENDING' || w.status === 'APPROVED'}>
                      {t(`status.${w.status}`)}
                    </Chip>
                    {w.status === 'REJECTED' && w.adminNote && (
                      <span className="mt-1.5 block max-w-[14rem] text-[11px] leading-snug text-heat">
                        {t('rejectedReason')}: {w.adminNote}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Reveal>
  );
}
