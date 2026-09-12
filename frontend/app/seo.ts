import { locales, type Locale } from '../i18n';

/**
 * One source of truth for what search engines are told.
 *
 * The site serves every page under a locale prefix (`/en/...`, `/zh/...`,
 * `/ko/...`) and most of it behind a login. Both facts matter here: without
 * hreflang the three locales look like three copies of the same page and
 * compete with each other, and without a robots policy the crawler spends
 * its budget on dashboards that redirect it straight back to /login.
 */

/**
 * The canonical origin.
 *
 * Must match whichever host the deployment actually serves as production.
 * Vercel is configured with `www` as production and the apex 308-redirecting
 * to it, so a canonical on the apex would point every page at a redirect.
 * Set `NEXT_PUBLIC_SITE_URL` to whichever one is primary.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.voltaragrid.com'
).replace(/\/$/, '');

/**
 * Paths that exist for search engines: readable without an account, and
 * meaningfully different from one another.
 *
 * Deliberately excludes `/login` (a form, nothing to rank) and every
 * `[code]` route — those are per-miner share links, not site pages, and a
 * sitemap full of them would be noise that never resolves for anyone else.
 */
/**
 * The official X account, without the @.
 *
 * Lives here next to SITE_URL because it is brand identity rather than page
 * content: it appears in the Twitter card of every page, in the footer, and
 * in the share intents the referral screen builds. It was written out by hand
 * in four places and the backend had drifted to a different handle, so the
 * FOLLOW bounty was sending miners to an account that is not ours.
 *
 * One constant, because the account does not exist yet and the handle may
 * still have to change if it turns out to be taken.
 */
export const X_HANDLE = 'VoltaraGrid';
export const X_TAG = `@${X_HANDLE}`;
export const X_URL = `https://x.com/${X_HANDLE}`;

export const PUBLIC_PATHS = ['', '/faq', '/terms', '/privacy'] as const;

/**
 * Everything behind the login.
 *
 * Listed rather than inferred so that adding a private page is a deliberate
 * act: a new authed route that nobody remembers to add here simply gets
 * crawled, found to redirect, and quietly wastes budget.
 */
export const PRIVATE_SEGMENTS = [
  'dashboard',
  'rig',
  'boosters',
  'leaderboard',
  'referrals',
  'withdraw',
  'kyc',
  'profile',
  'challenge',
  'daily',
  'duels',
  'duel',
  'squad',
  'apprentice',
  'watch',
  'admin',
  'support',
  'r',
] as const;

/** `https://host/en/faq` — the absolute URL of one page in one locale. */
export function urlFor(locale: Locale, path: string): string {
  return `${SITE_URL}/${locale}${path}`;
}

/**
 * `alternates` for a page, in every locale plus `x-default`.
 *
 * `x-default` points at English: it is what a searcher gets when their own
 * language is not one of the three, and pointing it at a locale-less URL
 * would 404 — every route here carries a prefix (`localePrefix: 'always'`).
 */
export function alternatesFor(locale: Locale, path = '') {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = urlFor(l, path);
  languages['x-default'] = urlFor('en', path);

  return {
    canonical: urlFor(locale, path),
    languages,
  };
}
