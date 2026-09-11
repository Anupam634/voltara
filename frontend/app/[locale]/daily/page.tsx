import { setRequestLocale } from 'next-intl/server';
import DailyClient from './daily-client';

export default function DailyPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <DailyClient />;
}
