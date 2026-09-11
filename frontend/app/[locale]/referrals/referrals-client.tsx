'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  getReferralStats,
  ReferralStatsResponse,
  ReferralMember,
  getToken,
  getMiningStatus,
  remindReferral,
  ApiError,
  type MiningStatus,
} from '../../../lib/api';
import { fill, rigCardPath, useShare } from '../../../components/share/strings';
import { AppShell } from '../../../components/AppShell';
import { RewardLadder } from '../../../components/referrals/RewardLadder';
import {
  AnimatedNumber,
  Button,
  Chip,
  Eyebrow,
  Icon,
  Input,
  Notice,
  Panel,
  Progress,
  Reveal,
  Segmented,
  Skeleton,
  Stat,
} from '../../../components/ui';
import { useMiningFX } from '../../../lib/use-mining-fx';

const TIER_TITLES: Record<number, string> = {
  1: 'Free Miner',
  2: 'Bronze Scout',
  3: 'Silver Leader',
  4: 'Gold Master',
  5: 'Platinum Syndicate',
  6: 'Cyber Sovereign',
};

const tierTitle = (level: number | undefined) => TIER_TITLES[level ?? 1] ?? TIER_TITLES[1];

const BASE_RATES = [0.9, 2.9, 5.9, 12.9, 65.9];

export default function ReferralsClient({ locale }: { locale: string }) {
  const t = useTranslations('referrals');
  const SHARE = useShare();
  const router = useRouter();
  const { playTick } = useMiningFX();

  const [stats, setStats] = useState<ReferralStatsResponse | null>(null);
  /**
   * The miner's own rate and stability, for the share text. Best-effort: a
   * failure just means the generic line goes out instead of the boast.
   */
  const [mine, setMine] = useState<MiningStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Search & filter for the team roster
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'IDLE'>('ALL');

  // Referral reminder: which row is mid-flight, and the last outcome per row.
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindNotice, setRemindNotice] = useState<{ id: string; tone: 'ok' | 'error'; text: string } | null>(
    null,
  );

  // Interactive calculator
  const [calcInvites, setCalcInvites] = useState(5);
  const [calcBaseRate, setCalcBaseRate] = useState(0.9);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/${locale}/login`);
      return;
    }
    loadData();
    // The share text wants the miner's live numbers, but the page must not
    // wait on them — a failure here only costs the boast, not the link.
    getMiningStatus()
      .then(setMine)
      .catch(() => setMine(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, router]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const data = await getReferralStats();
      setStats(data);
      if (data.totalInvited > 0) {
        setCalcInvites(Math.max(data.totalInvited, 5));
      }
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to load referral network.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemind(member: ReferralMember) {
    if (remindingId) return;
    setRemindingId(member.id);
    setRemindNotice(null);
    try {
      const result = await remindReferral(member.id);
      setStats((prev) =>
        prev
          ? {
              ...prev,
              referralsList: prev.referralsList.map((m) =>
                m.id === member.id
                  ? {
                      ...m,
                      reminder: {
                        canSend: false,
                        reason: 'COOLDOWN',
                        sentAt: result.sentAt,
                        availableAt: result.availableAt,
                      },
                    }
                  : m,
              ),
            }
          : prev,
      );
      setRemindNotice({ id: member.id, tone: 'ok', text: t('remindSent') });
    } catch (err: unknown) {
      setRemindNotice({
        id: member.id,
        tone: 'error',
        text: err instanceof ApiError ? err.message : t('remindFailed'),
      });
    } finally {
      setRemindingId(null);
    }
  }

  const referralCode = stats?.referralCode || '';
  const domain = typeof window !== 'undefined' ? window.location.origin : 'https://voltaragrid.com';
  /**
   * What gets shared is the rig card, not a bare invite: the link unfurls
   * into an image of this miner's actual build. The referral still rides on
   * `?ref=`, which the card page puts on its sign-up call to action.
   */
  const referralLink = referralCode ? `${domain}${rigCardPath(locale, referralCode)}` : '';
  const shareText = mine
    ? fill(SHARE.share.text, {
        rate: mine.ratePerHour.toFixed(1),
        stability: mine.rig?.gridStability ?? 100,
      })
    : SHARE.share.textNoRig;

  const copyToClipboard = async (text: string, type: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      playTick();
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      // Clipboard unavailable — the field is select-all, so a manual copy works.
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: SHARE.share.title,
          text: shareText,
          url: referralLink,
        });
      } catch {
        // User cancelled or unsupported
      }
    } else {
      copyToClipboard(referralLink, 'link');
    }
  };

  // Calculator multiplier helper (mirrors the referral tier table)
  const getSimulatedMultiplier = (invites: number) => {
    if (invites >= 31) return 8;
    if (invites >= 21) return 6;
    if (invites >= 11) return 5;
    if (invites >= 6) return 4;
    if (invites >= 1) return 3;
    return 1;
  };

  const simMultiplier = getSimulatedMultiplier(calcInvites);
  const simEffectiveRate = calcBaseRate * simMultiplier;
  const simDailyPoints = simEffectiveRate * 24;
  const simMonthlyVolts = (simDailyPoints * 30) / 3; // 3 VOLTS = 1 $VLTR

  const filteredRoster = (stats?.referralsList || []).filter((m) => {
    if (filterStatus === 'ACTIVE' && !m.isMiningActive) return false;
    if (filterStatus === 'IDLE' && m.isMiningActive) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return m.maskedEmail.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
    }
    return true;
  });

  const totalInvited = stats?.totalInvited ?? 0;
  const activeCount = stats?.activeMinersCount ?? 0;
  const idleCount = totalInvited - activeCount;

  const shareLinks = [
    {
      key: 'telegram',
      label: t('shareTelegram'),
      href: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(
        shareText,
      )}`,
    },
    {
      key: 'x',
      label: t('shareTwitter'),
      href: `https://x.com/intent/post?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(
        shareText,
      )}&hashtags=VOLTARA,BNBChain`,
    },
    {
      key: 'whatsapp',
      label: t('shareWhatsApp'),
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${referralLink}`)}`,
    },
  ];

  return (
    <AppShell
      locale={locale}
      backLabel={t('back')}
      eyebrow="Node affiliate network"
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <Button variant="charge" onClick={handleNativeShare}>
          <Icon name="share" size={14} />
          {t('share')}
        </Button>
      }
    >
      <div className="space-y-6">
        {error && (
          <Notice tone="heat" icon={<Icon name="x" size={14} />}>
            <p>{error}</p>
            <Button variant="danger" size="sm" className="mt-2" onClick={loadData}>
              Retry
            </Button>
          </Notice>
        )}

        {/* ─── Invite link + share ─── */}
        <div className="grid gap-5 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <Panel hud tone="charge" className="h-full space-y-4 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <Eyebrow>{t('code')}</Eyebrow>
                <Chip tone="charge" dot className="v-num">
                  Active node key
                </Chip>
              </div>

              {loading && !stats ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="v-inset flex items-center justify-between gap-2 p-3">
                  <span className="v-num min-w-0 flex-1 select-all truncate text-lg font-extrabold text-charge sm:text-xl">
                    {referralCode || '…'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(referralCode, 'code')}>
                    <Icon name={copiedCode ? 'check' : 'copy'} size={12} />
                    {copiedCode ? t('copied') : t('copyLink')}
                  </Button>
                </div>
              )}

              <div>
                <span className="v-label">{t('yourLink')}</span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input type="text" readOnly value={referralLink} className="v-num select-all truncate py-2.5 text-xs" />
                  <Button variant="primary" className="shrink-0" onClick={() => copyToClipboard(referralLink, 'link')}>
                    <Icon name={copiedLink ? 'check' : 'copy'} size={14} />
                    {copiedLink ? t('copied') : t('copyLink')}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {shareLinks.map((s) => (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="v-btn v-btn--ghost v-btn--sm"
                  >
                    <Icon name="arrow-up-right" size={12} />
                    <span className="truncate">{s.label}</span>
                  </a>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    playTick();
                    setShowQr((v) => !v);
                  }}
                  aria-pressed={showQr}
                >
                  <Icon name="chip" size={12} />
                  <span className="truncate">{t('qrCode')}</span>
                </Button>
              </div>
            </Panel>
          </Reveal>

          <Reveal index={1} className="lg:col-span-5">
            <Panel className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center sm:p-6">
              {showQr && referralCode ? (
                <div className="animate-pop">
                  <div className="v-inset inline-block p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(referralLink)}`}
                      alt="Referral QR code"
                      width={180}
                      height={180}
                      className="rounded-xl bg-white p-2"
                    />
                  </div>
                  <p className="mt-3 text-[11px] font-medium text-ink-3">{t('scanToJoin')}</p>
                </div>
              ) : (
                <>
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/12 text-brand-hi">
                    <Icon name="chip" size={26} />
                  </span>
                  <p className="text-sm font-bold text-ink">{t('qrCode')}</p>
                  <p className="max-w-xs text-[11px] leading-relaxed text-ink-3">{t('scanToJoin')}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      playTick();
                      setShowQr(true);
                    }}
                  >
                    {t('qrCode')}
                  </Button>
                </>
              )}
            </Panel>
          </Reveal>
        </div>

        {/* ─── Network HUD ─── */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Reveal index={0}>
            <Stat
              label={t('totalInvited')}
              value={<AnimatedNumber value={totalInvited} decimals={0} />}
              icon={<Icon name="users" size={14} />}
              hint="Tier 1"
            />
          </Reveal>
          <Reveal index={1}>
            <Stat
              label={t('activeMiners')}
              value={<AnimatedNumber value={activeCount} decimals={0} />}
              icon={<Icon name="bolt" size={14} />}
              tone="charge"
              hint={t('active')}
            />
          </Reveal>
          <Reveal index={2}>
            <Stat
              label={t('multiplier')}
              value={
                <>
                  <AnimatedNumber value={stats?.currentTier.multiplier ?? 1} decimals={0} />×
                </>
              }
              icon={<Icon name="sparkle" size={14} />}
              tone="brand"
              hint={`Level ${stats?.currentTier.level ?? 1}`}
            />
          </Reveal>
          <Reveal index={3}>
            <Stat
              label={t('currentTier')}
              value={<span className="font-display text-lg sm:text-xl">{tierTitle(stats?.currentTier.level)}</span>}
              icon={<Icon name="trophy" size={14} />}
              hint={`Level ${stats?.currentTier.level ?? 1}`}
            />
          </Reveal>
        </section>

        {/* ─── Tier ladder ─── */}
        <Reveal>
          <Panel hud className="space-y-6 p-5 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Eyebrow tone="charge">{t('tierProgression')}</Eyebrow>
                <h2 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">
                  {tierTitle(stats?.currentTier.level)}
                </h2>
              </div>
              {stats?.nextTier && (
                <Chip tone="brand">
                  {t('invitesNeeded', {
                    count: stats.invitesNeededForNext,
                    level: stats.nextTier.level,
                    multiplier: stats.nextTier.multiplier,
                  })}
                </Chip>
              )}
              {stats && !stats.nextTier && <Chip tone="charge">{t('maxTierReached')}</Chip>}
            </div>

            {stats?.nextTier && (
              <div>
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold">
                  <span className="text-ink-2">
                    Level {stats.currentTier.level} ({stats.currentTier.multiplier}×)
                  </span>
                  <span className="v-num text-charge">{stats.progressToNextPercent}%</span>
                  <span className="text-ink-2">
                    Level {stats.nextTier.level} ({stats.nextTier.multiplier}×)
                  </span>
                </div>
                <Progress value={stats.progressToNextPercent} charge />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(stats?.allTiers || []).map((tier, i) => {
                const isCurrent = stats?.currentTier.level === tier.level;
                const isUnlocked = (stats?.currentTier.level ?? 1) >= tier.level;
                const range =
                  tier.minInvites === 0
                    ? 'No invites needed'
                    : tier.maxInvites >= 2000
                      ? `${tier.minInvites}+ invites`
                      : `${tier.minInvites}–${tier.maxInvites} invites`;
                return (
                  <div
                    key={tier.level}
                    className={`v-panel relative p-4 transition ${
                      isCurrent ? 'v-panel--charge' : isUnlocked ? '' : 'opacity-70'
                    }`}
                    style={{ ['--i' as string]: i }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Eyebrow>Tier {tier.level}</Eyebrow>
                      <Chip tone={isCurrent ? 'charge' : isUnlocked ? 'ok' : 'default'} className="text-[9px]">
                        {isUnlocked && !isCurrent && <Icon name="check" size={10} />}
                        {!isUnlocked && <Icon name="lock" size={10} />}
                        {isCurrent ? 'Current' : isUnlocked ? t('unlocked') : t('locked')}
                      </Chip>
                    </div>
                    <h3 className="mt-2 font-display text-base font-bold text-ink">{TIER_TITLES[tier.level] ?? `Tier ${tier.level}`}</h3>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className={`v-num text-2xl font-extrabold ${isCurrent ? 'text-charge' : 'text-brand-hi'}`}>
                        {tier.multiplier}×
                      </span>
                      <span className="v-num text-[11px] text-ink-3">{range}</span>
                    </div>
                  </div>
                );
              })}
              {loading && !stats &&
                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
            </div>
          </Panel>
        </Reveal>

        {/* ─── Hardware reward ladder ─── */}
        <RewardLadder
          tiers={stats?.rewardTiers}
          totalInvited={stats?.totalInvited ?? 0}
          loading={loading}
        />

        {/* ─── Calculator ─── */}
        <Reveal>
          <Panel className="p-5 sm:p-8">
            <Eyebrow tone="brand">{t('calculatorTitle')}</Eyebrow>
            <h2 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">{t('calculatorSubtitle')}</h2>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex justify-between text-xs font-bold">
                    <span className="text-ink-2">{t('invitesCount')}</span>
                    <span className="v-num text-charge">{calcInvites}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={calcInvites}
                    onChange={(e) => setCalcInvites(Number(e.target.value))}
                    className="w-full cursor-pointer"
                    style={{ accentColor: 'rgb(var(--c-charge))' }}
                    aria-label={t('invitesCount')}
                  />
                  <div className="v-num mt-1 flex justify-between text-[10px] text-ink-3">
                    <span>0</span>
                    <span>10</span>
                    <span>20</span>
                    <span>30</span>
                    <span>40</span>
                    <span>50</span>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex justify-between text-xs font-bold">
                    <span className="text-ink-2">{t('baseRateLabel')}</span>
                    <span className="v-num text-brand-hi">{calcBaseRate.toFixed(2)} VOLTS/h</span>
                  </div>
                  <Segmented
                    value={String(calcBaseRate)}
                    options={BASE_RATES.map((r) => ({ value: String(r), label: r.toFixed(1) }))}
                    onChange={(v) => {
                      playTick();
                      setCalcBaseRate(Number(v));
                    }}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="v-inset space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <Eyebrow>Multiplier</Eyebrow>
                  <Chip tone="charge">{simMultiplier}× boost</Chip>
                </div>
                <div className="flex items-center justify-between border-t border-line/15 pt-3 text-sm">
                  <span className="text-ink-3">{t('projectedSpeed')}</span>
                  <span className="v-num font-extrabold text-ink">
                    <AnimatedNumber value={simEffectiveRate} decimals={2} duration={500} /> /h
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-3">{t('dailyPts')}</span>
                  <span className="v-num font-extrabold text-ink">
                    <AnimatedNumber value={simDailyPoints} decimals={1} duration={500} /> VOLTS
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-charge/30 bg-charge/[0.07] p-3">
                  <span className="text-xs font-bold text-ink-2">{t('monthlyTokens')}</span>
                  <span className="v-num text-xl font-extrabold text-charge">
                    ~<AnimatedNumber value={simMonthlyVolts} decimals={0} duration={500} /> $VLTR
                  </span>
                </div>
              </div>
            </div>
          </Panel>
        </Reveal>

        {/* ─── Team roster ─── */}
        <Reveal>
          <Panel className="space-y-5 p-5 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Eyebrow>{totalInvited} miners</Eyebrow>
                <h2 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">{t('teamRoster')}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  value={filterStatus}
                  options={[
                    { value: 'ALL', label: `All (${totalInvited})` },
                    { value: 'ACTIVE', label: `${t('active')} (${activeCount})` },
                    { value: 'IDLE', label: `${t('idle')} (${idleCount})` },
                  ]}
                  onChange={(v) => {
                    playTick();
                    setFilterStatus(v);
                  }}
                />
                <div className="relative w-full sm:w-52">
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('maskedMiner')}
                    className="py-2 pl-9 text-xs"
                  />
                  <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-2.5 text-ink-3" />
                </div>
              </div>
            </div>

            {loading && !stats ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="v-inset p-8 text-center text-xs text-ink-3">
                <Icon name="users" size={28} className="mx-auto text-brand-hi" />
                <p className="mx-auto mt-3 max-w-md">{t('noReferralsYet')}</p>
                <Button variant="charge" size="sm" className="mt-4" onClick={handleNativeShare}>
                  <Icon name="share" size={12} />
                  {t('share')}
                </Button>
              </div>
            ) : (
              <div className="v-inset overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-xs">
                  <thead>
                    <tr className="border-b border-line/20 font-mono text-[10px] uppercase tracking-wider text-ink-3">
                      <th className="p-3.5">{t('maskedMiner')}</th>
                      <th className="p-3.5">Country</th>
                      <th className="p-3.5">{t('status')}</th>
                      <th className="p-3.5">{t('joined')}</th>
                      <th className="p-3.5" title={t('remindHint')}>
                        {t('remindColumn')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="v-stagger divide-y divide-line/10">
                    {filteredRoster.map((m) => (
                      <tr key={m.id} className="transition-colors hover:bg-surface-2/50">
                        <td className="v-num p-3.5 font-bold text-ink">{m.maskedEmail}</td>
                        <td className="v-num p-3.5 text-ink-2">{m.countryCode}</td>
                        <td className="p-3.5">
                          <Chip tone={m.isMiningActive ? 'ok' : 'default'} dot={m.isMiningActive} className="text-[10px]">
                            {m.isMiningActive ? t('active') : t('idle')}
                          </Chip>
                        </td>
                        <td className="v-num p-3.5 text-ink-3">{new Date(m.joinedAt).toLocaleDateString()}</td>
                        <td className="p-3.5">
                          <RemindCell
                            member={m}
                            busy={remindingId === m.id}
                            notice={remindNotice?.id === m.id ? remindNotice : null}
                            onRemind={() => handleRemind(m)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </Reveal>

        <Reveal>
          <Notice icon={<Icon name="shield" size={16} />}>
            <div className="text-xs font-extrabold text-ink">{t('integrityTitle')}</div>
            <p className="mt-1 text-[11px] leading-relaxed">{t('integrityBody')}</p>
          </Notice>
        </Reveal>
      </div>
    </AppShell>
  );
}

/* ───────────────────────────── Remind ───────────────────────────── */

/**
 * One roster row's "nudge this miner" control. An idle miner with an inbox
 * gets a button; everyone else gets a one-line reason in place of it, so the
 * column never looks broken — just answered.
 */
function RemindCell({
  member,
  busy,
  notice,
  onRemind,
}: {
  member: ReferralMember;
  busy: boolean;
  notice: { tone: 'ok' | 'error'; text: string } | null;
  onRemind: () => void;
}) {
  const t = useTranslations('referrals');
  const { reminder } = member;

  let body: React.ReactNode;
  if (reminder.canSend || busy) {
    body = (
      <Button variant="ghost" size="sm" onClick={onRemind} loading={busy} title={t('remindHint')}>
        <Icon name="bell" size={12} />
        {busy ? t('remindSending') : t('remind')}
      </Button>
    );
  } else if (reminder.reason === 'COOLDOWN' && reminder.availableAt) {
    body = (
      <span className="text-ink-3">
        {t('remindAgainOn', { date: new Date(reminder.availableAt).toLocaleDateString() })}
      </span>
    );
  } else if (reminder.reason === 'NO_EMAIL') {
    body = <span className="text-ink-3">{t('remindNoEmail')}</span>;
  } else {
    body = <span className="text-ink-3">—</span>;
  }

  return (
    <div className="space-y-1">
      {body}
      {notice && (
        <div role="status" className={`text-[10px] font-semibold ${notice.tone === 'ok' ? 'text-ok' : 'text-heat'}`}>
          {notice.text}
        </div>
      )}
    </div>
  );
}
