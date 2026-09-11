import { setRequestLocale } from 'next-intl/server';
import RigClient from './rig-client';

export default function RigPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <RigClient />;
}
