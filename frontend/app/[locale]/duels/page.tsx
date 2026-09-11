import { setRequestLocale } from 'next-intl/server';
import DuelsClient from './duels-client';

export default function DuelsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <DuelsClient />;
}
