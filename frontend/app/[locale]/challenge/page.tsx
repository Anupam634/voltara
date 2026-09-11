import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import ChallengeClient from './challenge-client';

export default function ChallengePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  // The client reads `?build=` so a shared rig code opens the builder with
  // that build already socketed. useSearchParams() opts a route out of
  // prerendering unless it sits under a Suspense boundary.
  return (
    <Suspense>
      <ChallengeClient />
    </Suspense>
  );
}
