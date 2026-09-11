import { Space_Grotesk, JetBrains_Mono, Inter } from 'next/font/google';

/**
 * Three faces, each with one job:
 *   display  Space Grotesk — headlines and the wordmark
 *   sans     Inter — body copy
 *   mono     JetBrains Mono — every number that ticks
 *
 * next/font self-hosts the files, so the CSP's `font-src 'self'` holds.
 */
export const fontDisplay = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-mono',
  display: 'swap',
});
