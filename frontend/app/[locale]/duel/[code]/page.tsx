import { setRequestLocale } from 'next-intl/server';
import DuelLandingClient from './duel-client';

export const dynamicParams = true;

/** The share landing: works signed-out, so a challenge link can travel anywhere. */
export default function DuelLandingPage({
  params: { locale, code },
}: {
  params: { locale: string; code: string };
}) {
  setRequestLocale(locale);
  return <DuelLandingClient code={code} />;
}
