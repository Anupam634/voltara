import { setRequestLocale } from 'next-intl/server';
import SquadClient from './squad-client';

export default function SquadPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  return <SquadClient />;
}
