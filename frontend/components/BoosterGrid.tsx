'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Icon, Reveal } from './ui';

interface CoreItem {
  code: string;
  name: string;
  price: number;
  rate: string;
  nameKey: 'starter' | 'power' | 'pro' | 'enterprise';
  boost: string;
  /** Thermal units of heat and watts of draw this core adds to the rig. */
  heat: number;
  watts: number;
  /** Price of the core PLUS the cooling and power it needs to hold 100%. */
  buildPrice: number;
  isPopular?: boolean;
  isMax?: boolean;
  powerMeter: number;
}

/**
 * The four cores, quoted honestly (SPEC §2a).
 *
 * Each card shows two prices: the core, and the whole build. The second one
 * is the real one — a VC-5 alone overheats on a stock chassis and earns less
 * than the VC-1 does, so a card that advertised only the first would be
 * selling a rate the miner cannot reach. Mirrors `backend/prisma/seed.js`.
 */
const CORES: CoreItem[] = [
  { code: 'VC1', name: 'VC-1 Volt Core', price: 1, buildPrice: 1, rate: '2.9', nameKey: 'starter', boost: '2.0', heat: 10, watts: 45, powerMeter: 35 },
  { code: 'VC5', name: 'VC-5 Arc Core', price: 5, buildPrice: 10, rate: '10.9', nameKey: 'power', boost: '10.0', heat: 26, watts: 110, powerMeter: 60 },
  { code: 'VC10', name: 'VC-10 Plasma Core', price: 10, buildPrice: 19, rate: '20.9', nameKey: 'pro', boost: '20.0', heat: 48, watts: 200, isPopular: true, powerMeter: 80 },
  { code: 'VC50', name: 'VC-50 Fusion Core', price: 50, buildPrice: 82, rate: '90.9', nameKey: 'enterprise', boost: '90.0', heat: 190, watts: 760, isMax: true, powerMeter: 100 },
];

export function BoosterGrid({ locale }: { locale: string }) {
  const t = useTranslations('landing.boosters');
  const registerLink = `/${locale}/login?mode=register`;

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {CORES.map((b, i) => (
        <Reveal key={b.code} index={i} scale>
          <div
            className={`v-panel v-panel--lift v-trace-border relative flex h-full flex-col justify-between overflow-hidden p-6 ${
              b.isPopular ? 'v-panel--charge' : ''
            }`}
          >
            {/* Part-kind stripe: every card here is a core. */}
            <span className="rig-slot__kind rig-slot__kind--core" />

            {(b.isPopular || b.isMax) && (
              <span
                className={`absolute right-4 top-4 v-chip ${b.isPopular ? 'v-chip--charge' : 'v-chip--brand'}`}
              >
                <Icon name={b.isPopular ? 'star' : 'sparkle'} size={11} />
                {b.isPopular ? t('popularBadge') : t('maxYieldBadge')}
              </span>
            )}

            <div>
              <div className="v-eyebrow">{t(b.nameKey)}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/12 text-brand-hi">
                  <Icon name="chip" size={16} />
                </span>
                <span className="truncate font-display text-base font-bold text-ink">{b.name}</span>
              </div>
              <div className="v-num mt-3 text-3xl font-extrabold text-ink">
                ${b.price}
                <span className="ml-1 text-xs font-semibold text-ink-3">/ 30d</span>
              </div>

              {/* Resulting rate */}
              <div className="v-inset mt-5 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{t('resultingRate')}</div>
                <div className="v-num mt-1 text-2xl font-extrabold text-charge">
                  {b.rate} <span className="text-xs font-semibold text-ink-3">VOLTS/h</span>
                </div>
                <div className="mt-1 text-[11px] font-bold text-ok">{t('hashBoost', { rate: b.boost })}</div>

                {/* The running cost, on the same card as the benefit. */}
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line/15 pt-2.5 font-mono text-[10px] font-bold">
                  <span className="inline-flex items-center gap-1 rounded border border-heat/40 bg-heat/10 px-1.5 py-0.5 text-heat">
                    <Icon name="flame" size={10} />+{b.heat} TU
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-warn">
                    <Icon name="plug" size={10} />−{b.watts} W
                  </span>
                </div>
                <div className="mt-2 text-[11px] leading-snug text-ink-3">
                  {b.buildPrice === b.price ? t('fitsChassis') : t('fullBuild', { price: b.buildPrice })}
                </div>
              </div>

              {/* Power meter */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-ink-3">
                  <span>{t('hashpower')}</span>
                  <span className="v-num text-brand-hi">{b.powerMeter}%</span>
                </div>
                <div className="v-track h-1.5">
                  <div className="v-track__fill" style={{ width: `${b.powerMeter}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-line/15 pt-4">
              <div className="text-center text-[11px] text-ink-3">{t('terms')}</div>
              <Link
                href={registerLink}
                className={`v-btn mt-3 w-full ${b.isPopular ? 'v-btn--charge' : 'v-btn--ghost'}`}
              >
                {t('activateButton')}
                <Icon name="arrow-up-right" size={13} />
              </Link>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
