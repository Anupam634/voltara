'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '../lib/api';
import { Icon } from './ui';

/**
 * Whether a miner session exists in this browser.
 *
 * The landing page is statically generated, so the server has no idea who
 * the visitor is — the JWT lives in localStorage. This starts as `false` so
 * the first client render matches the prerendered HTML exactly (no hydration
 * mismatch), then flips after mount if a token is present.
 */
function useIsAuthed(): boolean {
  const [authed, setAuthed] = useState(false);
  useEffect(() => setAuthed(!!getToken()), []);
  return authed;
}

/**
 * Nav pair. Signed out shows "Sign in" + "Get started"; signed in collapses
 * to a single link through to the dashboard, so a logged-in visitor isn't
 * invited to create a second account.
 */
export function NavAuth({
  locale,
  signInLabel,
  getStartedLabel,
  dashboardLabel,
}: {
  locale: string;
  signInLabel: string;
  getStartedLabel: string;
  dashboardLabel: string;
}) {
  const authed = useIsAuthed();

  if (authed) {
    return (
      <Link href={`/${locale}/dashboard`} className="v-btn v-btn--charge v-btn--sm">
        <span className="sm:hidden">App</span>
        <span className="hidden sm:inline">{dashboardLabel}</span>
        <Icon name="arrow-up-right" size={13} />
      </Link>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
      <Link
        href={`/${locale}/login`}
        className="hidden whitespace-nowrap px-2 text-xs font-bold text-ink-2 transition hover:text-ink sm:inline-flex"
      >
        {signInLabel}
      </Link>
      <Link href={`/${locale}/login?mode=register`} className="v-btn v-btn--charge v-btn--sm">
        <span className="sm:hidden">Start</span>
        <span className="hidden sm:inline">{getStartedLabel}</span>
        <Icon name="bolt" size={13} />
      </Link>
    </div>
  );
}

/**
 * A call-to-action that points at signup while signed out and at the
 * dashboard once signed in.
 */
export function AuthAwareCta({
  locale,
  href,
  className,
  label,
  dashboardLabel,
}: {
  locale: string;
  /** Where to send a signed-out visitor. */
  href: string;
  className?: string;
  label: string;
  dashboardLabel: string;
}) {
  const authed = useIsAuthed();
  return (
    <Link href={authed ? `/${locale}/dashboard` : href} className={className ?? 'v-btn v-btn--charge v-btn--lg'}>
      <span>{authed ? dashboardLabel : label}</span>
      <Icon name="arrow-up-right" size={15} />
    </Link>
  );
}

/**
 * Wrapper that hides its children once the visitor is signed in — used for
 * the "I already have an account" secondary CTA, which is meaningless then.
 */
export function HideWhenAuthed({ children }: { children: React.ReactNode }) {
  const authed = useIsAuthed();
  if (authed) return null;
  return <>{children}</>;
}
