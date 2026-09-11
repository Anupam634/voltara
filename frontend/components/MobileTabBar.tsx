'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMiningFX } from '../lib/use-mining-fx';
import { Icon, type IconName } from './ui';

/**
 * Phone navigation. Four routes around a raised MINE button. The button
 * glows lime only while a claim is ready — the one place on the bar that
 * wears the charge colour.
 */
export function MobileTabBar({
  locale,
  onMine,
  ready = false,
  claiming = false,
}: {
  locale: string;
  onMine?: () => void;
  ready?: boolean;
  claiming?: boolean;
}) {
  const t = useTranslations('dashboard');
  const pathname = usePathname() || '';
  const [shock, setShock] = useState(0);
  const { playMiningStrike } = useMiningFX();

  const isDashboard = pathname.endsWith(`/${locale}/dashboard`) || pathname.endsWith(`/${locale}`);
  const isRig = pathname.includes('/rig') || pathname.includes('/boosters');
  const isProfile = pathname.includes('/profile') || pathname.includes('/kyc') || pathname.includes('/support');
  const isRanks =
    pathname.includes('/leaderboard') ||
    pathname.includes('/referrals') ||
    pathname.includes('/duel') ||
    pathname.includes('/squad');

  const handleMine = () => {
    playMiningStrike();
    setShock((n) => n + 1);
    onMine?.();
  };

  const items: { href: string; label: string; icon: IconName; on: boolean }[] = [
    { href: `/${locale}/dashboard`, label: t('navDashboard'), icon: 'home', on: isDashboard },
    { href: `/${locale}/rig`, label: t('navRig'), icon: 'rig', on: isRig },
  ];
  const itemsRight: { href: string; label: string; icon: IconName; on: boolean }[] = [
    { href: `/${locale}/leaderboard`, label: 'Ranks', icon: 'trophy', on: isRanks },
    { href: `/${locale}/profile`, label: t('navProfile'), icon: 'user', on: isProfile },
  ];

  const renderTab = (it: (typeof items)[number]) => (
    <Link
      key={it.href}
      href={it.href}
      className={`flex flex-col items-center justify-center gap-1 py-1 text-center transition ${
        it.on ? 'text-ink' : 'text-ink-3 hover:text-ink-2'
      }`}
    >
      <span
        className={`grid h-8 w-8 place-items-center rounded-xl transition-all ${
          it.on ? 'bg-brand/20 text-charge shadow-[0_0_18px_-4px_rgb(var(--c-brand)/0.8)]' : ''
        }`}
      >
        <Icon name={it.icon} size={18} />
      </span>
      <span className="text-[10px] font-bold tracking-tight">{it.label}</span>
    </Link>
  );

  return (
    <nav
      className="v-glass fixed inset-x-0 bottom-0 z-40 border-t lg:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      aria-label="Mobile navigation"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-2">
        {items.map(renderTab)}

        <div className="relative -mt-7 flex flex-col items-center">
          {onMine ? (
            <button
              type="button"
              onClick={handleMine}
              disabled={claiming}
              aria-label={t('mineButton')}
              className={`relative grid h-16 w-16 place-items-center rounded-full border-4 border-bg transition-all active:scale-95 ${
                ready
                  ? 'v-btn--charge text-[#0b1204] shadow-charge'
                  : 'bg-surface-3 text-ink-3 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.8)]'
              }`}
              style={{ clipPath: 'none' }}
            >
              {shock > 0 && <span key={shock} className="v-shock" />}
              {claiming ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Icon name="bolt" size={26} strokeWidth={2.4} className={ready ? 'animate-breathe' : ''} />
              )}
            </button>
          ) : (
            <Link
              href={`/${locale}/dashboard`}
              aria-label={t('mineButton')}
              className="grid h-16 w-16 place-items-center rounded-full border-4 border-bg bg-gradient-to-br from-brand to-brand-hi text-white shadow-volt transition-all active:scale-95"
            >
              <Icon name="bolt" size={26} strokeWidth={2.4} />
            </Link>
          )}
          <span className={`mt-1 text-[10px] font-extrabold tracking-wide ${ready ? 'text-charge' : 'text-ink-3'}`}>
            {t('mineButton')}
          </span>
        </div>

        {itemsRight.map(renderTab)}
      </div>
    </nav>
  );
}
