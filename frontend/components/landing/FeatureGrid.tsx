'use client';

import Link from 'next/link';
import { Icon, Reveal, SectionHeading, type IconName } from '../ui';
import { useLanding } from './strings';

/**
 * The systems that sit on top of the rig — events, overclock, duels,
 * squads, the player market, the weekly blueprint, salvage and skins.
 *
 * A bento grid rather than an even row of tiles: the four systems that
 * change how a rig is played get the wide cells, and the four that decorate
 * or recycle it get the narrow ones, so the page states its own priorities.
 */

type CardKey =
  | 'events'
  | 'overclock'
  | 'duels'
  | 'squads'
  | 'market'
  | 'blueprint'
  | 'salvage'
  | 'skins';

/** Layout and accent per card. `wide` spans two columns from `lg` up. */
const CARDS: {
  key: CardKey;
  icon: IconName;
  wide?: boolean;
  tone: 'brand' | 'charge' | 'heat';
}[] = [
  { key: 'events', icon: 'flame', wide: true, tone: 'heat' },
  { key: 'overclock', icon: 'bolt', tone: 'heat' },
  { key: 'duels', icon: 'trophy', tone: 'charge' },
  { key: 'squads', icon: 'users', tone: 'brand' },
  { key: 'market', icon: 'market', tone: 'brand' },
  { key: 'blueprint', icon: 'chip', wide: true, tone: 'charge' },
  { key: 'salvage', icon: 'gift', tone: 'brand' },
  { key: 'skins', icon: 'sparkle', tone: 'brand' },
];

const TONE: Record<'brand' | 'charge' | 'heat', { icon: string; chip: string }> = {
  brand: {
    icon: 'border-brand/30 bg-brand/12 text-brand-hi',
    chip: 'border-brand/35 bg-brand/10 text-brand-hi',
  },
  charge: {
    icon: 'border-charge/30 bg-charge/12 text-charge',
    chip: 'border-charge/35 bg-charge/10 text-charge',
  },
  heat: {
    icon: 'border-heat/30 bg-heat/12 text-heat',
    chip: 'border-heat/35 bg-heat/10 text-heat',
  },
};

export function FeatureGrid({ register }: { register: string }) {
  const S = useLanding();

  return (
    <>
      <Reveal>
        <SectionHeading eyebrow={S.eyebrow} title={S.title} subtitle={S.subtitle} />
      </Reveal>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card, i) => {
          const copy = S.cards[card.key];
          const tone = TONE[card.tone];
          return (
            <Reveal key={card.key} index={i} className={card.wide ? 'lg:col-span-2' : undefined}>
              <article className="v-panel v-panel--lift v-hud v-trace-border flex h-full flex-col p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${tone.icon}`}
                  >
                    <Icon name={card.icon} size={20} />
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold ${tone.chip}`}
                  >
                    {copy.detail}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-lg font-bold text-ink">{copy.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{copy.body}</p>
              </article>
            </Reveal>
          );
        })}
      </div>

      <Reveal index={8}>
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <Link href={register} className="v-btn v-btn--charge v-btn--lg">
            {S.cta}
            <Icon name="chevron-right" size={16} />
          </Link>
          <p className="text-xs text-ink-3">{S.ctaNote}</p>
        </div>
      </Reveal>
    </>
  );
}
