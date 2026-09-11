import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import BoostersClient from './boosters-client';

export default function BoostersPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  // The client reads `?part=` so a rescue CTA can point at the one part that
  // fixes the rig. useSearchParams() opts a route out of prerendering unless
  // it sits under a Suspense boundary.
  return (
    <Suspense>
      <BoostersClient />
    </Suspense>
  );
}
