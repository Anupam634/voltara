'use client';

import { useTranslations } from 'next-intl';
import { Icon, Reveal, SectionHeading } from './ui';

const TIERS = [
  { level: 1, invites: '0', multiplier: 1 },
  { level: 2, invites: '1–5', multiplier: 3 },
  { level: 3, invites: '6–10', multiplier: 4 },
  { level: 4, invites: '11–20', multiplier: 5 },
  { level: 5, invites: '21–30', multiplier: 6 },
  { level: 6, invites: '31+', multiplier: 8, isMax: true },
];

export function ReferralTierMatrix() {
  const t = useTranslations('landing.referrals');

  return (
    <div>
      <SectionHeading eyebrow="Referrals" title={t('title')} subtitle={t('subtitle')} />

      <Reveal className="mt-8 flex justify-center">
        <span className="v-chip v-chip--charge v-chip--wrap">
          <Icon name="users" size={12} className="shrink-0" />
          {t('bonusNote')}
        </span>
      </Reveal>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {TIERS.map((tier, i) => (
          <Reveal key={tier.level} index={i} scale>
            <div
              className={`v-panel v-panel--lift v-hud relative flex h-full flex-col justify-between p-5 ${
                tier.isMax ? 'v-panel--charge' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="v-chip">L{tier.level}</span>
                  {tier.isMax && (
                    <span className="v-chip v-chip--charge">
                      <Icon name="star" size={10} />
                      MAX
                    </span>
                  )}
                </div>
                <div className="mt-5 text-center">
                  <div className={`v-num text-4xl font-extrabold ${tier.isMax ? 'text-charge' : 'text-ink'}`}>
                    ×{tier.multiplier}
                  </div>
                  <div className="v-eyebrow mt-1">{t('multiplier')}</div>
                </div>
              </div>

              <div className="v-inset mt-5 p-2.5 text-center">
                <div className="text-[10px] font-bold uppercase text-ink-3">{t('invited')}</div>
                <div className="v-num mt-0.5 text-sm font-extrabold text-ink">{tier.invites}</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
