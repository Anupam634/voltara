import { setRequestLocale } from 'next-intl/server';
import WatchClient from './watch-client';

export const dynamicParams = true;

/**
 * Spectator mode: watch another miner's rig run.
 *
 * Public on purpose. The leaderboard is public, so a stranger arriving from
 * it has no account yet — and a rig climbing towards a brownout is the
 * cheapest demonstration of what this product actually is.
 */
export default function WatchPage({
  params: { locale, code },
}: {
  params: { locale: string; code: string };
}) {
  setRequestLocale(locale);
  return <WatchClient locale={locale} code={code} />;
}
