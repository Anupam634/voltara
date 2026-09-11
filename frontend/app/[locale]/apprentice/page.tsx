import { setRequestLocale } from 'next-intl/server';
import ApprenticeClient from './apprentice-client';

export default function ApprenticePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <ApprenticeClient />;
}
