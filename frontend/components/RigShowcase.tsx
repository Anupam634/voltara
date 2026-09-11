'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Gauge, Icon, type IconName } from './ui';

/**
 * The landing page's argument, made in one moving picture.
 *
 * It plays the loop a miner actually lives: a core goes in and the rate
 * jumps, a second core goes in and the rig overheats and the rate collapses,
 * a cooler and a PSU go in and it comes back higher than before. Nobody
 * reads a paragraph about thermal throttling; everybody understands a
 * number that falls and then recovers.
 *
 * Purely illustrative — the numbers mirror the seeded catalogue, but the
 * real ones come from the engine on `/rig`.
 */

type Kind = 'CORE' | 'COOLER' | 'PSU' | 'EMPTY';

interface Part {
  kind: Kind;
  name: string;
  hash: number;
  heat: number;
  cooling: number;
  watts: number;
  supply: number;
}

const EMPTY: Part = { kind: 'EMPTY', name: '', hash: 0, heat: 0, cooling: 0, watts: 0, supply: 0 };

const VC1: Part = { kind: 'CORE', name: 'VC-1', hash: 2, heat: 10, cooling: 0, watts: 45, supply: 0 };
const VC10: Part = { kind: 'CORE', name: 'VC-10', hash: 20, heat: 48, cooling: 0, watts: 200, supply: 0 };
const CX6: Part = { kind: 'COOLER', name: 'CX-6', hash: 0, heat: 0, cooling: 120, watts: 40, supply: 0 };
const PS3: Part = { kind: 'PSU', name: 'PS-3', hash: 0, heat: 4, cooling: 0, watts: 0, supply: 260 };

/** Chassis figures, mirroring rig.engine.ts. */
const CHASSIS_COOLING = 12;
const CHASSIS_WATTS = 120;
const BASE_RATE = 0.9;

/** The four beats of the story, in order. */
const STEPS: { slots: Part[]; caption: string }[] = [
  { slots: [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], caption: 'empty' },
  { slots: [VC1, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], caption: 'firstCore' },
  { slots: [VC1, VC10, EMPTY, EMPTY, EMPTY, EMPTY], caption: 'overheat' },
  { slots: [VC1, VC10, CX6, PS3, EMPTY, EMPTY], caption: 'fixed' },
];

const KIND_STYLE: Record<Kind, { stripe: string; icon: IconName | null; text: string }> = {
  CORE: { stripe: 'rig-slot__kind--core', icon: 'chip', text: 'text-brand-hi' },
  COOLER: { stripe: 'rig-slot__kind--cooler', icon: 'snow', text: 'text-[#67e8f9]' },
  PSU: { stripe: 'rig-slot__kind--psu', icon: 'plug', text: 'text-charge' },
  EMPTY: { stripe: '', icon: null, text: '' },
};

/** The same arithmetic the server runs, at illustration scale. */
function readout(slots: Part[]) {
  const hash = slots.reduce((n, p) => n + p.hash, 0);
  const heat = slots.reduce((n, p) => n + p.heat, 0);
  const cooling = CHASSIS_COOLING + slots.reduce((n, p) => n + p.cooling, 0);
  const draw = slots.reduce((n, p) => n + p.watts, 0);
  const supply = CHASSIS_WATTS + slots.reduce((n, p) => n + p.supply, 0);

  const thermal = heat <= cooling ? 1 : Math.max(0.25, cooling / heat);
  const power = draw <= supply ? 1 : Math.max(0.1, supply / draw);

  return {
    hash,
    heat,
    cooling,
    draw,
    supply,
    stability: Math.round(thermal * power * 100),
    rate: (BASE_RATE + hash) * thermal * power,
    overheating: heat > cooling,
    brownout: draw > supply,
  };
}

export function RigShowcase() {
  const t = useTranslations('landing.rig');
  const [step, setStep] = useState(0);
  /** Pause once a visitor takes control, so it stops moving under them. */
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (manual) return;
    const id = setInterval(() => setStep((n) => (n + 1) % STEPS.length), 2600);
    return () => clearInterval(id);
  }, [manual]);

  const { slots, caption } = STEPS[step];
  const r = readout(slots);
  const critical = r.stability < 60;
  const rateTone = r.stability >= 100 ? 'text-charge' : r.stability >= 60 ? 'text-warn' : 'text-heat';

  return (
    <div
      className={`v-panel v-hud v-scanlines relative overflow-hidden rounded-3xl p-5 sm:p-7 ${
        r.overheating ? 'v-panel--heat' : r.stability >= 100 && r.hash > 0 ? 'v-panel--charge' : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-5">
        <Gauge value={r.stability} size={140} stroke={11} label={t('stability')} />
        <div className="min-w-0 flex-1 text-right">
          <div className="v-eyebrow">{t('rate')}</div>
          <div className={`v-num mt-1 text-3xl font-extrabold sm:text-4xl ${rateTone}`}>
            {r.rate.toFixed(2)}
            <span className="ml-1 text-sm font-bold text-ink-3">VOLTS/h</span>
          </div>
          <div className="v-trace mt-2 ml-auto w-2/3" />
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 ${
                r.overheating ? 'border-heat/40 bg-heat/10 text-heat' : 'border-line/15 bg-bg/40 text-ink-3'
              }`}
            >
              <Icon name="flame" size={11} />
              {t('heat')} {r.heat}/{r.cooling}
            </div>
            <div
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 ${
                r.brownout ? 'border-heat/40 bg-heat/10 text-heat' : 'border-line/15 bg-bg/40 text-ink-3'
              }`}
            >
              <Icon name="plug" size={11} />
              {t('watts')} {r.draw}/{r.supply}
            </div>
          </div>
        </div>
      </div>

      <div className="stability-track mt-5">
        <div
          className={`stability-fill ${
            r.stability >= 100 ? '' : critical ? 'stability-fill--critical' : 'stability-fill--warn'
          }`}
          style={{ width: `${r.stability}%` }}
        />
      </div>

      <div className="rig-grid mt-4">
        {slots.map((p, i) => {
          const style = KIND_STYLE[p.kind];
          const hot = r.overheating && p.kind === 'CORE';
          return (
            <div
              key={i}
              className={`rig-slot !min-h-[4.5rem] !p-2.5 ${
                p.kind === 'EMPTY' ? 'rig-slot--empty' : `rig-slot--filled rig-slot--installing ${hot ? 'rig-slot--hot' : ''}`
              }`}
            >
              {p.kind !== 'EMPTY' && <span className={`rig-slot__kind ${style.stripe}`} />}
              <span className="font-mono text-[9px] uppercase tracking-widest text-ink-3">
                {String(i + 1).padStart(2, '0')}
              </span>
              {p.kind === 'EMPTY' ? (
                <span className="text-[11px] font-bold opacity-60">—</span>
              ) : (
                <span className={`inline-flex items-center gap-1 text-xs font-extrabold ${style.text}`}>
                  {style.icon && <Icon name={style.icon} size={12} />}
                  {p.name}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p key={caption} className="mt-4 min-h-[2.5rem] animate-fade text-sm leading-snug text-ink-2">
        {t(`step.${caption}`)}
      </p>

      {/* Step dots — also the manual control, so the story can be replayed. */}
      <div className="mt-3 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.caption}
            type="button"
            aria-label={`Step ${i + 1}`}
            onClick={() => {
              setManual(true);
              setStep(i);
            }}
            className={`h-1.5 rounded-full transition-all ${
              i === step ? 'w-8 bg-charge' : 'w-3 bg-line/25 hover:bg-line/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
