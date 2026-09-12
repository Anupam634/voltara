import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SITE_URL, X_TAG } from '../../../seo';
import RigCardClient from './rig-card-client';

/**
 * The public landing a shared rig link points at.
 *
 * Its whole job is the unfurl: `generateMetadata` points Open Graph and
 * Twitter at `/api/og/rig/<code>`, so X, Telegram and WhatsApp show the
 * miner's actual build instead of the one static card every share used to
 * carry. The page itself then has to be worth the click, so it renders the
 * rig large with a single "Beat this rig" call to action.
 *
 * Dynamic, not static: the rate and stability on the card move, and a
 * prerendered title would freeze whatever they were at build time.
 */
export const dynamic = 'force-dynamic';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

interface CardHead {
  name: string;
  ratePerHour: number;
  gridStability: number;
  partCount: number;
}

/** Just enough of the card to write the title. Failures fall back silently. */
async function loadHead(code: string): Promise<CardHead | null> {
  try {
    const res = await fetch(`${API}/rig/card/${encodeURIComponent(code)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as CardHead;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params: { locale, code },
}: {
  params: { locale: string; code: string };
}): Promise<Metadata> {
  const head = await loadHead(code);
  const image = `${SITE_URL}/api/og/rig/${encodeURIComponent(code)}`;

  const title = head
    ? `${head.ratePerHour.toFixed(1)} VOLTS/h at ${head.gridStability}% stability — beat this rig`
    : 'VOLTARA — Build the rig. Hold the grid.';
  const description = head
    ? `${head.name} is running ${head.partCount} parts on VOLTARA. Six slots, real heat and power costs. Build a rig that beats it.`
    : 'Socket cores, coolers and PSUs into a six-slot rig, keep GRID STABILITY at 100%, and convert VOLTS to on-chain $VLTR.';

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/${locale}/r/${code}` },
    openGraph: {
      type: 'website',
      siteName: 'VOLTARA',
      title,
      description,
      url: `${SITE_URL}/${locale}/r/${code}`,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      site: X_TAG,
      title,
      description,
      images: [image],
    },
  };
}

export default function SharedRigPage({
  params: { locale, code },
}: {
  params: { locale: string; code: string };
}) {
  setRequestLocale(locale);
  return <RigCardClient locale={locale} code={code} />;
}
