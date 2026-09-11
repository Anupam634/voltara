'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  getProfile,
  getToken,
  logout,
  WITHDRAWAL_MIN_POINTS,
  type Profile,
} from '../../../lib/api';
import { AppShell } from '../../../components/AppShell';
import { BnbBadge } from '../../../components/BnbLogo';
import {
  AnimatedNumber,
  Button,
  ButtonLink,
  Chip,
  Eyebrow,
  Icon,
  Notice,
  Panel,
  Reveal,
  Skeleton,
  type ChipTone,
  type IconName,
} from '../../../components/ui';
import { countryFlag, countryName } from '../../../lib/countries';
import { useMiningFX } from '../../../lib/use-mining-fx';

/** 3 points = 1 $VLTR BEP-20. */
const POINTS_PER_TOKEN = 3;

const KYC_TONE: Record<Profile['kycStatus'], ChipTone> = {
  APPROVED: 'ok',
  PENDING: 'warn',
  REJECTED: 'heat',
  NONE: 'default',
};

export default function ProfileClient() {
  const t = useTranslations('profile');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProfile(await getProfile());
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

  function signOut() {
    logout();
    router.replace(`/${locale}/login`);
  }

  return (
    <AppShell
      locale={locale}
      backLabel={t('backToDashboard')}
      width="max-w-4xl"
      eyebrow="Operator"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      {error && (
        <Notice tone="heat" icon={<Icon name="x" size={16} />} className="mb-5">
          {error}
        </Notice>
      )}

      {!profile ? (
        <div className="space-y-4">
          <Panel className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          </Panel>
          <Panel className="p-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="mt-4 h-12 w-full" />
          </Panel>
          <Panel className="p-6">
            <Skeleton className="h-24 w-full" />
          </Panel>
        </div>
      ) : (
        <div className="space-y-4">
          <IdentityCard profile={profile} locale={locale} />
          <div className="grid gap-4 md:grid-cols-5">
            <BalanceCard profile={profile} locale={locale} className="md:col-span-3" />
            <KycCard profile={profile} locale={locale} className="md:col-span-2" />
          </div>
          <ReferralCard profile={profile} locale={locale} />
          <HelpCard locale={locale} />

          <Reveal index={5}>
            <Button variant="danger" onClick={signOut} className="w-full py-3.5">
              <Icon name="logout" size={16} />
              {t('signOut')}
            </Button>
          </Reveal>
        </div>
      )}
    </AppShell>
  );
}

/* ─────────────────────────── Identity ───────────────────────────── */

function initialsOf(email: string | null, code: string): string {
  const local = (email ?? '').split('@')[0];
  const parts = local.split(/[._-]+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return (chars || code.slice(0, 2)).toUpperCase();
}

function IdentityCard({ profile, locale }: { profile: Profile; locale: string }) {
  const t = useTranslations('profile');
  return (
    <Reveal index={0}>
      <Panel hud className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-hi font-display text-xl font-bold text-white shadow-volt ring-4 ring-brand/20">
            {initialsOf(profile.email, profile.referralCode)}
            <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-surface bg-charge text-[#0b1204]">
              <Icon name="bolt" size={10} strokeWidth={3} />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg font-bold text-ink sm:text-xl">{profile.email ?? '—'}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="globe" size={12} className="text-ink-3" />
                {profile.countryCode
                  ? `${countryFlag(profile.countryCode)} ${countryName(profile.countryCode, locale)}`
                  : '—'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="clock" size={12} className="text-ink-3" />
                {t('memberSince')} {new Date(profile.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <Chip tone="brand">
            L{profile.referralTier.level} · ×{profile.referralTier.multiplier}
          </Chip>
        </div>

        <div className="v-divider my-4" />

        <dl className="grid gap-3 text-xs sm:grid-cols-3">
          <Row label={t('email')} value={profile.email ?? '—'} />
          <Row label={t('country')} value={profile.countryCode ? countryName(profile.countryCode, locale) : '—'} />
          <Row label={t('userId')} value={profile.id} mono />
        </dl>
      </Panel>
    </Reveal>
  );
}

/* ─────────────────────────── Balance ────────────────────────────── */

function BalanceCard({ profile, locale, className = '' }: { profile: Profile; locale: string; className?: string }) {
  const t = useTranslations('profile');
  const canWithdraw = profile.kycStatus === 'APPROVED' && profile.pointsBalance >= WITHDRAWAL_MIN_POINTS;

  return (
    <Reveal index={1} className={className}>
      <Panel hud tone={canWithdraw ? 'charge' : 'default'} className="h-full p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>{t('balance')}</Eyebrow>
          <BnbBadge label={t('chainName')} />
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <AnimatedNumber
            value={profile.pointsBalance}
            decimals={2}
            className={`text-4xl font-extrabold sm:text-5xl ${canWithdraw ? 'text-charge' : 'text-ink'}`}
          />
          <span className="text-sm font-bold text-brand-hi">{t('pointsShort')}</span>
        </div>
        <div className="mt-1 text-sm text-ink-2">
          ≈{' '}
          <AnimatedNumber
            value={profile.pointsBalance / POINTS_PER_TOKEN}
            decimals={4}
            className="font-bold text-brand-hi"
          />{' '}
          $VLTR
        </div>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <ButtonLink href={`/${locale}/withdraw`} variant={canWithdraw ? 'charge' : 'primary'} className="w-full">
            <Icon name="swap" size={16} />
            {t('withdrawCta')}
          </ButtonLink>
          <ButtonLink href={`/${locale}/boosters`} variant="ghost" className="w-full">
            <Icon name="chip" size={16} />
            Parts shop
          </ButtonLink>
        </div>

        {!canWithdraw && (
          <p className="mt-3 text-center text-xs text-ink-3">
            {profile.kycStatus !== 'APPROVED'
              ? t('withdrawNeedsKyc')
              : t('withdrawNeedsBalance', { min: WITHDRAWAL_MIN_POINTS })}
          </p>
        )}
      </Panel>
    </Reveal>
  );
}

/* ─────────────────────────── KYC ────────────────────────────────── */

function KycCard({ profile, locale, className = '' }: { profile: Profile; locale: string; className?: string }) {
  const t = useTranslations('profile');
  const approved = profile.kycStatus === 'APPROVED';
  const icon: IconName = approved ? 'check' : profile.kycStatus === 'PENDING' ? 'clock' : 'shield';

  return (
    <Reveal index={2} className={className}>
      <Panel hud className="flex h-full flex-col p-5 sm:p-6">
        <Eyebrow>{t('identityTitle')}</Eyebrow>
        <div className="mt-4 flex flex-1 flex-col items-center justify-center text-center">
          <span
            className={`grid h-14 w-14 place-items-center rounded-2xl border ${
              approved
                ? 'border-ok/40 bg-ok/10 text-ok'
                : profile.kycStatus === 'PENDING'
                  ? 'border-warn/40 bg-warn/10 text-warn'
                  : profile.kycStatus === 'REJECTED'
                    ? 'border-heat/40 bg-heat/10 text-heat'
                    : 'border-line/30 bg-surface-2 text-ink-3'
            }`}
          >
            <Icon name={icon} size={24} />
          </span>
          <Chip tone={KYC_TONE[profile.kycStatus]} dot={profile.kycStatus !== 'NONE'} className="mt-3">
            {t(`kycStatus.${profile.kycStatus}`)}
          </Chip>
        </div>
        <ButtonLink href={`/${locale}/kyc`} variant={approved ? 'ghost' : 'primary'} size="sm" className="mt-4 w-full">
          {approved ? t('viewKyc') : t('completeKyc')}
          <Icon name="chevron-right" size={14} />
        </ButtonLink>
      </Panel>
    </Reveal>
  );
}

/* ─────────────────────────── Referral ───────────────────────────── */

function ReferralCard({ profile, locale }: { profile: Profile; locale: string }) {
  const t = useTranslations('profile');
  const { playTick } = useMiningFX();
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState('');

  useEffect(() => {
    setLink(`${window.location.origin}/${locale}/login?ref=${profile.referralCode}`);
  }, [locale, profile.referralCode]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      playTick();
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <Reveal index={3}>
      <Panel hud className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>{t('referralTitle')}</Eyebrow>
          <Link
            href={`/${locale}/referrals`}
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-hi transition hover:text-charge"
          >
            Invite
            <Icon name="arrow-up-right" size={12} />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="v-inset p-3">
            <div className="v-eyebrow">{t('referralCode')}</div>
            <div className="v-num mt-1 truncate text-base font-extrabold text-charge">{profile.referralCode}</div>
          </div>
          <div className="v-inset p-3">
            <div className="v-eyebrow">{t('invited')}</div>
            <div className="v-num mt-1 text-base font-extrabold text-ink">{profile.referralCount}</div>
          </div>
          <div className="v-inset p-3">
            <div className="v-eyebrow">{t('tier')}</div>
            <div className="v-num mt-1 text-base font-extrabold text-brand-hi">
              L{profile.referralTier.level} ×{profile.referralTier.multiplier}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <code className="v-inset flex-1 truncate px-3 py-2.5 font-mono text-xs text-ink-2">{link || '…'}</code>
          <Button variant={copied ? 'charge' : 'primary'} size="sm" onClick={copy} className="shrink-0">
            <Icon name={copied ? 'check' : 'copy'} size={14} />
            {copied ? 'Copied' : t('copy')}
          </Button>
        </div>
      </Panel>
    </Reveal>
  );
}

/* ─────────────────────────── Help ───────────────────────────────── */

function HelpCard({ locale }: { locale: string }) {
  const t = useTranslations('profile');
  const links: { href: string; label: string; icon: IconName }[] = [
    { href: `/${locale}/support`, label: t('contactSupport'), icon: 'help' },
    { href: `/${locale}/faq`, label: t('readFaq'), icon: 'search' },
    { href: `/${locale}/terms`, label: t('terms'), icon: 'shield' },
    { href: `/${locale}/privacy`, label: t('privacy'), icon: 'lock' },
  ];
  return (
    <Reveal index={4}>
      <Panel hud className="p-5 sm:p-6">
        <Eyebrow>{t('helpTitle')}</Eyebrow>
        <ul className="mt-3 divide-y divide-line/15">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="group flex items-center gap-3 py-3 text-sm font-semibold text-ink-2 transition hover:text-ink"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand-hi transition group-hover:bg-brand/20">
                  <Icon name={l.icon} size={15} />
                </span>
                <span className="flex-1">{l.label}</span>
                <Icon name="chevron-right" size={14} className="text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-charge" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </Reveal>
  );
}

/* ─────────────────────────── Shared ─────────────────────────────── */

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="v-eyebrow">{label}</dt>
      <dd className={`mt-1 break-all font-medium text-ink-2 ${mono ? 'v-num text-[11px]' : 'text-sm'}`}>{value}</dd>
    </div>
  );
}
