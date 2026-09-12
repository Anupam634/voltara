import type { MetadataRoute } from 'next';
import { PRIVATE_SEGMENTS, SITE_URL } from './seo';

/**
 * Served at /robots.txt.
 *
 * Most of this site is behind a login, and a crawler that follows those
 * links gets a redirect to /login for its trouble — repeated once per locale
 * per page. Disallowing them is not about hiding anything (they are already
 * unreachable without a token); it is about spending a finite crawl budget
 * on the four pages that can actually rank.
 *
 * The wildcard is load-bearing: every route carries a locale prefix, so the
 * path to block is `/*​/dashboard`, never `/dashboard`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_SEGMENTS.map((segment) => `/*/${segment}`),
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
