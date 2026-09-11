'use client';

import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { MobileTabBar } from './MobileTabBar';
import { Eyebrow } from './ui';

/**
 * Frame for every signed-in page: header, a titled content column, and
 * the phone tab bar. Pages that own the mine button (the dashboard) pass
 * `mine` so the bar's centre button fires their claim.
 */
export function AppShell({
  locale,
  backLabel,
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  width = 'max-w-6xl',
  mine,
}: {
  locale: string;
  backLabel?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: string;
  mine?: { onMine: () => void; ready: boolean; claiming: boolean };
}) {
  return (
    <div className="min-h-dvh">
      <AppHeader locale={locale} backLabel={backLabel} maxWidth={width} />
      <main className={`mx-auto w-full ${width} px-4 pb-32 pt-6 sm:px-6 sm:pt-8 lg:pb-16`}>
        {(title || actions) && (
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-rise sm:mb-8">
            <div className="min-w-0">
              {eyebrow && <Eyebrow tone="charge">{eyebrow}</Eyebrow>}
              {title && (
                <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl lg:text-4xl">
                  {title}
                </h1>
              )}
              {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-base">{subtitle}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
          </div>
        )}
        {children}
      </main>
      <MobileTabBar locale={locale} onMine={mine?.onMine} ready={mine?.ready} claiming={mine?.claiming} />
    </div>
  );
}
