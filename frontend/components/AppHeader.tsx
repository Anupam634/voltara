'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogoMark } from './Logo';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { Icon, type IconName } from './ui';

type Route = { href: string; label: string; icon: IconName; match: (p: string) => boolean; hint?: string };

/**
 * Signed-in header. Desktop shows the primary route rail plus a "Grid"
 * menu for the social and competitive surfaces; on phones it collapses to
 * logo + back link + utilities, and the MobileTabBar carries navigation.
 */
export function AppHeader({
  locale,
  backLabel,
  maxWidth = 'max-w-6xl',
}: {
  locale: string;
  backLabel?: string;
  maxWidth?: string;
}) {
  const t = useTranslations('dashboard');
  const pathname = usePathname() || '';
  const [gridOpen, setGridOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const primary: Route[] = [
    { href: `/${locale}/dashboard`, label: t('navDashboard'), icon: 'home', match: (p) => p.endsWith('/dashboard') },
    { href: `/${locale}/rig`, label: t('navRig'), icon: 'rig', match: (p) => p.includes('/rig') || p.includes('/boosters') },
    { href: `/${locale}/leaderboard`, label: 'Ranks', icon: 'trophy', match: (p) => p.includes('/leaderboard') },
    { href: `/${locale}/withdraw`, label: t('navWithdraw'), icon: 'swap', match: (p) => p.includes('/withdraw') },
  ];

  const grid: Route[] = [
    { href: `/${locale}/duels`, label: 'Rig Duels', icon: 'bolt', match: (p) => p.includes('/duel'), hint: '24h output race, 10% stake' },
    { href: `/${locale}/squad`, label: 'Squad', icon: 'users', match: (p) => p.includes('/squad'), hint: 'Pool cooling and power with 4 friends' },
    { href: `/${locale}/daily`, label: 'Daily', icon: 'star', match: (p) => p.includes('/daily'), hint: 'One shared build problem a day' },
    { href: `/${locale}/challenge`, label: 'Blueprint', icon: 'chip', match: (p) => p.includes('/challenge'), hint: 'Weekly cheapest-build contest' },
    { href: `/${locale}/apprentice`, label: 'Apprentices', icon: 'users', match: (p) => p.includes('/apprentice'), hint: 'Mentor a newcomer, earn a minted share' },
    { href: `/${locale}/referrals`, label: 'Invite', icon: 'share', match: (p) => p.includes('/referrals'), hint: 'Referral tiers and part rewards' },
  ];

  const gridActive = grid.some((r) => r.match(pathname));
  const isDashboard = pathname.endsWith('/dashboard');

  useEffect(() => {
    if (!gridOpen) return;
    const onDown = (e: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) setGridOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGridOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [gridOpen]);

  const linkClass = (on: boolean) =>
    `relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
      on ? 'bg-brand/15 text-ink' : 'text-ink-2 hover:bg-surface-2/70 hover:text-ink'
    }`;

  return (
    <header className="v-glass sticky top-0 z-40 border-b" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className={`mx-auto flex ${maxWidth} items-center justify-between gap-3 px-4 py-2.5 sm:px-6`}>
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/${locale}/dashboard`} className="flex items-center gap-2.5" aria-label="VOLTARA">
            <LogoMark size={30} />
            <span className="hidden font-display text-sm font-bold tracking-[0.18em] text-ink sm:inline">VOLTARA</span>
          </Link>
          {!isDashboard && backLabel && (
            <Link
              href={`/${locale}/dashboard`}
              className="inline-flex items-center gap-1 rounded-full border border-line/25 px-2.5 py-1 text-[11px] font-bold text-ink-2 transition hover:border-brand-hi/60 hover:text-ink lg:hidden"
            >
              <Icon name="chevron-left" size={12} />
              {backLabel}
            </Link>
          )}
        </div>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {primary.map((r) => {
            const on = r.match(pathname);
            return (
              <Link key={r.href} href={r.href} className={linkClass(on)}>
                <Icon name={r.icon} size={14} className={on ? 'text-charge' : ''} />
                {r.label}
                {on && <span className="absolute -bottom-[11px] left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-charge" />}
              </Link>
            );
          })}

          <div className="relative" ref={gridRef}>
            <button
              type="button"
              onClick={() => setGridOpen((o) => !o)}
              aria-expanded={gridOpen}
              className={linkClass(gridActive)}
            >
              <Icon name="sparkle" size={14} className={gridActive ? 'text-charge' : ''} />
              The Grid
              <Icon name="chevron-down" size={12} className={`transition ${gridOpen ? 'rotate-180' : ''}`} />
              {gridActive && (
                <span className="absolute -bottom-[11px] left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-charge" />
              )}
            </button>
            {gridOpen && (
              <div className="v-panel v-glass absolute left-0 top-full z-50 mt-3 w-64 animate-pop p-1.5">
                {grid.map((r) => {
                  const on = r.match(pathname);
                  return (
                    <Link
                      key={r.href}
                      href={r.href}
                      onClick={() => setGridOpen(false)}
                      className={`flex items-start gap-3 rounded-xl px-2.5 py-2 transition ${
                        on ? 'bg-brand/15 text-ink' : 'text-ink-2 hover:bg-surface-3/70 hover:text-ink'
                      }`}
                    >
                      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/10 ${on ? 'text-charge' : 'text-brand-hi'}`}>
                        <Icon name={r.icon} size={14} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-extrabold">{r.label}</span>
                        {r.hint && <span className="block text-[10px] leading-snug text-ink-3">{r.hint}</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher locale={locale} />
          <Link
            href={`/${locale}/profile`}
            aria-label={t('navProfile')}
            className={`grid h-8 w-8 place-items-center rounded-full border transition ${
              pathname.includes('/profile')
                ? 'border-charge/60 bg-charge/10 text-charge'
                : 'border-line/30 bg-surface-2/70 text-ink-2 hover:border-brand-hi/70 hover:text-ink'
            }`}
          >
            <Icon name="user" size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}
