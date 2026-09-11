'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ApiError, getToken } from '../../../../lib/api';
import { acceptDuel, getDuel, untilLabel, RETURN_PATH_KEY, type DuelDto } from '../../../../lib/api-social';
import { useSocial } from '../../../../components/social/strings';
import { LogoMark } from '../../../../components/Logo';
import { LocaleSwitcher } from '../../../../components/LocaleSwitcher';
import { ThemeToggle } from '../../../../components/ThemeToggle';
import { Button, Chip, Eyebrow, Gauge, Icon, Notice, Panel, Skeleton } from '../../../../components/ui';
import { useMiningFX } from '../../../../lib/use-mining-fx';

function fmt(n: number, digits = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * Where a challenge link lands. Public: a visitor with no account sees the
 * challenger's rig and a sign-up path; a signed-in miner accepts in one tap.
 */
export default function DuelLandingClient({ code }: { code: string }) {
  const { DUEL_LANDING: S, DUELS } = useSocial();
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const { playTick, playClaimReward, playError } = useMiningFX();

  const [duel, setDuel] = useState<DuelDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDuel(await getDuel(code));
      setNotFound(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err instanceof ApiError ? err.message : DUELS.offline);
    }
  }, [code]);

  useEffect(() => {
    setAuthed(!!getToken());
    load();
  }, [load]);

  const accept = async () => {
    setBusy(true);
    try {
      playTick();
      await acceptDuel(code);
      playClaimReward();
      router.replace(`/${locale}/duels`);
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : DUELS.offline);
      setBusy(false);
    }
  };

  const stashReturnPath = () => {
    try {
      localStorage.setItem(RETURN_PATH_KEY, `/${locale}/duel/${code}`);
    } catch {
      /* private mode */
    }
  };

  const signUpHref = `/${locale}/login?mode=register&next=${encodeURIComponent(`/${locale}/duel/${code}`)}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="v-glass sticky top-0 z-40 border-b" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2.5 sm:px-6">
          <Link href={`/${locale}`} className="flex items-center gap-2.5" aria-label="VOLTARA">
            <LogoMark size={30} />
            <span className="font-display text-sm font-bold tracking-[0.18em] text-ink">VOLTARA</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LocaleSwitcher locale={locale} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {notFound ? (
          <Notice tone="heat" icon={<Icon name="x" size={16} />}>
            {S.notFound}
          </Notice>
        ) : !duel ? (
          <Skeleton className="h-96 w-full rounded-3xl" />
        ) : (
          <Panel hud className="relative overflow-hidden p-5 animate-pop sm:p-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-charge/15 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7">
                <Eyebrow tone="charge">{S.eyebrow}</Eyebrow>
                <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  {S.title(duel.challenger.name)}
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-2 sm:text-base">{S.body}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Chip tone="brand">
                    <Icon name="wallet" size={12} />
                    {S.stakeLabel} {duel.stakePercent}%
                  </Chip>
                  <Chip>
                    <Icon name="clock" size={12} />
                    {S.windowLabel} {S.windowValue}
                  </Chip>
                  {duel.status === 'OPEN' && (
                    <Chip tone="charge" dot>
                      {DUELS.openTitle}
                    </Chip>
                  )}
                </div>

                {error && (
                  <Notice tone="heat" icon={<Icon name="x" size={16} />} className="mt-5">
                    {error}
                  </Notice>
                )}

                <div className="mt-7">
                  {duel.status !== 'OPEN' ? (
                    <Settled duel={duel} locale={locale} />
                  ) : duel.mine === 'challenger' ? (
                    <div className="space-y-3">
                      <Notice tone="brand" icon={<Icon name="share" size={16} />}>
                        {S.yours}
                      </Notice>
                      <Link href={`/${locale}/duels`} className="v-btn v-btn--primary">
                        {S.goToDuels}
                        <Icon name="chevron-right" size={14} />
                      </Link>
                    </div>
                  ) : authed ? (
                    <Button variant="charge" size="lg" loading={busy} onClick={accept}>
                      <Icon name="bolt" size={16} />
                      {busy ? S.accepting : S.accept}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Link href={signUpHref} onClick={stashReturnPath} className="v-btn v-btn--charge v-btn--lg">
                        <Icon name="bolt" size={16} />
                        {S.signUpToAccept}
                      </Link>
                      <p className="text-xs text-ink-3">{S.signInHint}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="v-inset v-scanlines relative p-5">
                  <Eyebrow>{S.challengerRig}</Eyebrow>
                  <div className="mt-4 flex items-center gap-4">
                    <Gauge value={duel.challenger.gridStability} size={112} stroke={10} label={DUELS.stability} />
                    <div className="min-w-0">
                      <p className="truncate text-base font-extrabold text-ink">{duel.challenger.name}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wider text-ink-3">{DUELS.rate}</p>
                      <p className="v-num text-3xl font-extrabold text-charge">{fmt(duel.challenger.ratePerHour)}</p>
                    </div>
                  </div>
                  <div className="v-trace mt-4" />
                  {duel.status === 'OPEN' && (
                    <p className="mt-3 text-[11px] text-ink-3">
                      {DUELS.endsIn}{' '}
                      <span className="v-num text-ink-2">
                        {untilLabel(new Date(new Date(duel.createdAt).getTime() + 48 * 3_600_000).toISOString())}
                      </span>
                    </p>
                  )}
                </div>
                <Link
                  href={`/${locale}`}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-ink-2 transition hover:text-ink"
                >
                  {S.learn}
                  <Icon name="arrow-up-right" size={12} />
                </Link>
              </div>
            </div>
          </Panel>
        )}
      </main>
    </div>
  );
}

function Settled({ duel, locale }: { duel: DuelDto; locale: string }) {
  const S = useSocial().DUEL_LANDING;
  const winner =
    duel.winnerId === duel.challenger.id ? duel.challenger : duel.winnerId === duel.opponent?.id ? duel.opponent : null;
  return (
    <div className="space-y-3">
      <Notice tone={duel.status === 'SETTLED' ? 'ok' : 'warn'} icon={<Icon name="clock" size={16} />}>
        {S.status[duel.status] ?? duel.status}
      </Notice>
      {duel.status === 'SETTLED' && (
        <div className="v-inset flex flex-wrap items-center gap-3 p-3.5">
          <Chip tone={winner ? 'charge' : 'default'}>
            <Icon name="trophy" size={12} />
            {winner ? `${S.winner}: ${winner.name}` : S.noWinner}
          </Chip>
          {winner && duel.transferPoints ? (
            <span className="v-num text-xs font-bold text-charge">+{fmt(duel.transferPoints)} VOLTS</span>
          ) : null}
        </div>
      )}
      <Link href={`/${locale}/duels`} className="v-btn v-btn--ghost">
        {S.goToDuels}
        <Icon name="chevron-right" size={14} />
      </Link>
    </div>
  );
}
