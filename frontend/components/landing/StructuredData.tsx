import { SITE_URL } from '../../app/seo';

/**
 * JSON-LD for the landing page.
 *
 * Meta tags say what one page is; this says what the *product* is, which is
 * what a search engine needs before it will show anything richer than a blue
 * link — a sitelinks box, a knowledge panel, the brand's own name rather
 * than a guess at it.
 *
 * Deliberately modest. Everything asserted here is verifiable on the page
 * itself: the name, what it does, that it is a free web application. No
 * `AggregateRating`, no `offers` with a price — VOLTARA has no reviews and
 * no listed product, and structured data that describes things which do not
 * exist is the kind of thing that gets a site's rich results turned off
 * entirely.
 */
export function StructuredData({ locale }: { locale: string }) {
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'VOLTARA',
      url: SITE_URL,
      logo: `${SITE_URL}/voltara-logo.png`,
      description:
        'VOLTARA is a mining simulation where a purchase is a part in a six-slot rig, not a flat rate bonus.',
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'VOLTARA',
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: locale,
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#app`,
      name: 'VOLTARA',
      url: `${SITE_URL}/${locale}`,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web, Android',
      inLanguage: locale,
      description:
        'Socket cores, coolers and power supplies into a six-slot mining rig. ' +
        'Every part makes heat or draws power, and GRID STABILITY multiplies ' +
        'everything the rig produces.',
      // The account and the base mining rate genuinely cost nothing, which is
      // the claim this makes. Parts are sold separately and are not described
      // here as offers, because their prices live in the app rather than on
      // this page.
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    },
  ];

  return (
    <script
      type="application/ld+json"
      // The content is a literal built above — no user input reaches it.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  );
}
