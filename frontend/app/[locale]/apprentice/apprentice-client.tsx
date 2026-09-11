'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  acceptApprenticeship,
  declineApprenticeship,
  endApprenticeship,
  getApprentice,
  getRig,
  getToken,
  giftPart,
  offerApprenticeship,
  type ApprenticeOverviewDto,
  type ApprenticeshipDto,
  type RigPartDto,
} from '../../../lib/api';
import { useSocial } from '../../../components/social/strings';
import { AppShell } from '../../../components/AppShell';
import {
  AnimatedNumber,
  Button,
  Chip,
  Eyebrow,
  Field,
  Gauge,
  Icon,
  Input,
  Modal,
  Notice,
  Panel,
  Reveal,
  Skeleton,
} from '../../../components/ui';
import { useMiningFX } from '../../../lib/use-mining-fx';
import { usePolling } from '../../../lib/use-polling';

const REFRESH_MS = 30_000;

function fmt(n: number, digits = 1): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Mentorship.
 *
 * The screen leads with what the mentor gives rather than what they take,
 * because the cut is minted rather than deducted and a newcomer reading this
 * page needs to see that immediately.
 */
export default function ApprenticeClient() {
  const S = useSocial().APPRENTICE;
  const t = useTranslations('dashboard');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const { playTick, playClaimReward, playError, playInstall } = useMiningFX();

  const [data, setData] = useState<ApprenticeOverviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [giftFor, setGiftFor] = useState<ApprenticeshipDto | null>(null);
  const [spare, setSpare] = useState<RigPartDto[]>([]);

  const load = useCallback(async () => {
    try {
      setData(await getApprentice());
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.replace(`/${locale}/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : S.offline);
    }
  }, [router, locale, S.offline]);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/${locale}/login`);
      return;
    }
    load();
  }, [load, router, locale]);

  usePolling(load, REFRESH_MS);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (ok) setInfo(ok);
      playClaimReward();
      await load();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : S.offline);
    } finally {
      setBusy(false);
    }
  };

  const submitOffer = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    playTick();
    await act(() => offerApprenticeship(code.trim()), S.offerSent);
    setCode('');
  };

  const openGift = async (a: ApprenticeshipDto) => {
    playTick();
    setGiftFor(a);
    try {
      const rig = await getRig();
      // Only genuinely spare parts: anything installed, listed or salvaged is
      // filtered by the server too, but showing it here would be a trap.
      setSpare(rig.inventory.filter((p) => !p.burned));
    } catch {
      setSpare([]);
    }
  };

  const doGift = async (boosterId: string) => {
    if (!giftFor) return;
    playInstall();
    await act(() => giftPart(giftFor.id, boosterId), S.gifted);
    setGiftFor(null);
  };

  if (!data) {
    return (
      <AppShell locale={locale} backLabel={t('navDashboard')} eyebrow={S.eyebrow} title={S.title}>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  const blockMessage = () => {
    switch (data.eligible.reason) {
      case 'TOO_NEW':
        return S.blockTooNew(data.eligible.daysToWait);
      case 'RIG_UNSTABLE':
        return S.blockUnstable;
      case 'AT_CAPACITY':
        return S.blockCapacity;
      case 'IS_APPRENTICE':
        return S.blockIsApprentice;
      default:
        return null;
    }
  };

  return (
    <AppShell
      locale={locale}
      backLabel={t('navDashboard')}
      eyebrow={S.eyebrow}
      title={S.title}
      subtitle={S.subtitle}
    >
      {error && (
        <Notice tone="heat" className="mb-4" icon={<Icon name="x" size={16} />}>
          {error}
        </Notice>
      )}
      {info && (
        <Notice tone="charge" className="mb-4" icon={<Icon name="check" size={16} />}>
          {info}
        </Notice>
      )}

      <div className="space-y-5">
        {/* An offer waiting on this miner outranks everything else. */}
        {data.invitesOpen.map((a) => (
          <Reveal key={a.id}>
            <Panel tone="charge" hud className="p-5">
              <Eyebrow tone="charge">{S.invitesTitle}</Eyebrow>
              <p className="mt-2 font-display text-lg font-bold text-ink">
                {a.other?.name ?? '—'}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{S.invitesBody}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="charge"
                  loading={busy}
                  onClick={() => act(() => acceptApprenticeship(a.id))}
                >
                  {S.accept}
                </Button>
                <Button
                  variant="ghost"
                  loading={busy}
                  onClick={() => act(() => declineApprenticeship(a.id))}
                >
                  {S.decline}
                </Button>
              </div>
            </Panel>
          </Reveal>
        ))}

        {/* What mentorship is, and what it pays. */}
        <Reveal index={1}>
          <Panel hud className="p-5 sm:p-6">
            <Eyebrow tone="charge">{S.eyebrow}</Eyebrow>
            <h2 className="mt-2 font-display text-xl font-bold text-ink">{S.heroTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{S.heroBody}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Point icon="gift" title={S.pointTeachTitle} body={S.pointTeachBody} />
              <Point icon="sparkle" title={S.pointEarnTitle} body={S.pointEarnBody} />
              <Point icon="users" title={S.pointCapTitle} body={S.pointCapBody} />
            </div>
            {data.mentorEarnedPoints > 0 && (
              <div className="v-inset mt-5 flex items-baseline justify-between gap-3 p-3">
                <span className="v-eyebrow">{S.earned}</span>
                <AnimatedNumber
                  value={data.mentorEarnedPoints}
                  decimals={2}
                  className="text-xl font-extrabold text-charge"
                />
              </div>
            )}
          </Panel>
        </Reveal>

        {/* Take on an apprentice. */}
        <Reveal index={2}>
          <Panel className="p-5">
            <Eyebrow>{S.offerTitle}</Eyebrow>
            {data.eligible.canMentor ? (
              <form onSubmit={submitOffer} className="mt-3 space-y-3">
                <Field hint={S.offerHint}>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={S.offerPlaceholder}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </Field>
                <Button type="submit" variant="primary" loading={busy} disabled={!code.trim()}>
                  {S.offerCta}
                  <Icon name="chevron-right" size={16} />
                </Button>
              </form>
            ) : (
              <Notice tone="warn" className="mt-3" icon={<Icon name="lock" size={16} />}>
                <span className="font-bold">{S.cannotMentor}</span>
                <span className="mt-1 block">{blockMessage()}</span>
              </Notice>
            )}
          </Panel>
        </Reveal>

        {/* Offers this miner has sent. */}
        {data.pendingOffers.length > 0 && (
          <Reveal index={3}>
            <Panel className="p-5">
              <Eyebrow>{S.pendingTitle}</Eyebrow>
              <ul className="mt-3 space-y-2">
                {data.pendingOffers.map((a) => (
                  <li key={a.id} className="v-inset flex items-center justify-between gap-3 p-3">
                    <span className="truncate text-sm font-bold text-ink">
                      {a.other?.name ?? '—'}
                    </span>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={busy}
                      onClick={() => act(() => endApprenticeship(a.id))}
                    >
                      {S.end}
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          </Reveal>
        )}

        {/* Active apprentices. */}
        <Reveal index={4}>
          <Panel className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow>{S.activeTitle}</Eyebrow>
              <Chip>{`${data.eligible.activeCount} / ${data.maxApprentices}`}</Chip>
            </div>
            {data.asMentor.length === 0 ? (
              <p className="mt-3 text-sm text-ink-3">{S.activeEmpty}</p>
            ) : (
              <ul className="v-stagger mt-3 space-y-3">
                {data.asMentor.map((a) => (
                  <li key={a.id}>
                    <PeerRow
                      a={a}
                      locale={locale}
                      S={S}
                      busy={busy}
                      onGift={() => openGift(a)}
                      onEnd={() => {
                        if (confirm(S.endConfirm)) act(() => endApprenticeship(a.id));
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Reveal>

        {/* This miner's own mentor. */}
        <Reveal index={5}>
          <Panel className="p-5">
            <Eyebrow>{S.myMentorTitle}</Eyebrow>
            {data.asApprentice ? (
              <div className="mt-3">
                <PeerRow
                  a={data.asApprentice}
                  locale={locale}
                  S={S}
                  busy={busy}
                  onEnd={() => {
                    if (confirm(S.endConfirm)) act(() => endApprenticeship(data.asApprentice!.id));
                  }}
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-3">{S.noMentor}</p>
            )}
          </Panel>
        </Reveal>
      </div>

      <Modal open={!!giftFor} onClose={() => setGiftFor(null)} title={S.giftTitle} wide>
        <p className="text-sm text-ink-2">{S.giftHint}</p>
        {spare.length === 0 ? (
          <Notice tone="warn" className="mt-4" icon={<Icon name="help" size={16} />}>
            {S.giftEmpty}
          </Notice>
        ) : (
          <ul className="mt-4 space-y-2">
            {spare.map((p) => (
              <li key={p.id} className="v-inset flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{p.name}</p>
                  <p className="v-num mt-0.5 text-[11px] text-ink-3">{p.kind}</p>
                </div>
                <Button variant="charge" size="sm" loading={busy} onClick={() => doGift(p.id)}>
                  {S.giftCta}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </AppShell>
  );
}

function Point({
  icon,
  title,
  body,
}: {
  icon: 'gift' | 'sparkle' | 'users';
  title: string;
  body: string;
}) {
  return (
    <div className="v-inset p-3.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-brand/30 bg-brand/10 text-brand-hi">
        <Icon name={icon} size={17} />
      </span>
      <p className="mt-2.5 text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

function PeerRow({
  a,
  locale,
  S,
  busy,
  onGift,
  onEnd,
}: {
  a: ApprenticeshipDto;
  locale: string;
  S: ReturnType<typeof useSocial>['APPRENTICE'];
  busy: boolean;
  onGift?: () => void;
  onEnd: () => void;
}) {
  const other = a.other;
  const cutOver = a.cutExpiresAt ? new Date(a.cutExpiresAt).getTime() < Date.now() : false;

  return (
    <div className="v-inset flex flex-wrap items-center gap-4 p-3.5">
      <Gauge value={other?.gridStability ?? 0} size={56} stroke={6} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{other?.name ?? '—'}</p>
        <p className="v-num mt-0.5 text-[11px] text-ink-3">
          {fmt(other?.ratePerHour ?? 0, 2)} VOLTS / h
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Chip tone="brand">{a.role === 'mentor' ? S.roleMentor : S.roleApprentice}</Chip>
          {a.cutExpiresAt && (
            <Chip tone={cutOver ? 'default' : 'charge'}>
              {cutOver
                ? S.cutEnded
                : `${S.cutEnds} ${new Date(a.cutExpiresAt).toLocaleDateString()}`}
            </Chip>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {other && (
          <Link
            href={`/${locale}/watch/${other.watchCode}`}
            className="v-btn v-btn--ghost v-btn--sm"
          >
            <Icon name="search" size={14} />
            {S.watch}
          </Link>
        )}
        {onGift && (
          <Button variant="primary" size="sm" loading={busy} onClick={onGift}>
            <Icon name="gift" size={14} />
            {S.gift}
          </Button>
        )}
        <Button variant="danger" size="sm" loading={busy} onClick={onEnd}>
          {S.end}
        </Button>
      </div>
    </div>
  );
}
