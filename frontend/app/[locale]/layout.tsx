import type { Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { locales } from '../../i18n';
import { fontDisplay, fontMono, fontSans } from '../fonts';
import { Backdrop } from '../../components/Backdrop';
import { THEME_STORAGE_KEY } from '../../components/theme';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://voltaragrid.com';
const TITLE = 'VOLTARA — Build the rig. Hold the grid.';
const DESCRIPTION =
  'Not another tap-to-earn. Socket cores, coolers and PSUs into a six-slot rig, keep GRID STABILITY at 100%, and convert VOLTS to on-chain $VLTR on BNB Chain. Overheat and your output throttles.';

// Open Graph + Twitter card: when a miner tweets their invite link (the
// "Post on X" bounty), X unfurls this image and title under the post.
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'VOLTARA',
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'VOLTARA — build the rig, hold the grid' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@VoltaraGrid',
    creator: '@VoltaraGrid',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#07060b',
};

/**
 * Applies the saved theme before first paint so a light-theme user never
 * sees an obsidian flash. Inline scripts are already allowed by the CSP for
 * the App Router's own hydration payload.
 */
const themeBoot = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var ok=['grid','substation','overdrive','overheat'];document.documentElement.setAttribute('data-theme',ok.indexOf(t)>-1?t:'grid');}catch(e){document.documentElement.setAttribute('data-theme','grid');}})();`;

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      data-theme="grid"
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        <Backdrop />
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
