import type { MetadataRoute } from 'next';
import { locales } from '../i18n';
import { PUBLIC_PATHS, SITE_URL, urlFor } from './seo';

/**
 * Served at /sitemap.xml.
 *
 * Every public page in every locale, each entry carrying the full set of
 * language alternates. Listing the alternates here as well as in the page
 * metadata is not redundant — it is the form Google reads most reliably for
 * a multilingual site, and it is what stops `/en/faq`, `/zh/faq` and
 * `/ko/faq` being treated as three competing copies of one page.
 *
 * The landing page is weighted above the legal pages because it is the one
 * that should rank; `terms` and `privacy` exist to be found by someone
 * looking for them, not to win a search.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return locales.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: urlFor(locale, path),
      lastModified,
      changeFrequency: (path === '' ? 'daily' : 'monthly') as 'daily' | 'monthly',
      priority: path === '' ? 1 : 0.4,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, urlFor(l, path)])),
      },
    })),
  );
}
