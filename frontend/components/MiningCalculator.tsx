'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AnimatedNumber, Icon } from './ui';

/**
 * The build calculator.
 *
 * It quotes a whole BUILD, not a part, because a part on its own is not a
 * rate any more: a VC-5 dropped on a bare chassis overheats and browns out at
 * once, and the "10.9/h" this page used to promise for $5 would be 4.8/h in
 * practice. Each option below is the core plus exactly the cooling and power
 * it needs to run at 100% stability, priced honestly — which also happens to
 * be the clearest possible explanation of the mechanic.
 *
 * The figures mirror `backend/prisma/seed.js` and the chassis constants in
 * `rig.engine.ts`. If the catalogue is repriced, update them here too.
 */

interface Part {
  code: string;
  name: string;
  price: number;
}

interface Build {
  id: string;
  /** Core hash added on top of the 0.9 base. */
  hash: number;
  /** The core, plus whatever it takes to run it at full stability. */
  parts: Part[];
}

const CHASSIS_NOTE = { cooling: 12, watts: 120 };

const BUILDS: Build[] = [
  { id: 'free', hash: 0, parts: [] },
  {
    id: 'vc1',
    hash: 2,
    // 10 TU and 45 W both fit inside the free chassis: nothing else to buy.
    parts: [{ code: 'VC1', name: 'VC-1 Volt Core', price: 1 }],
  },
  {
    id: 'vc5',
    hash: 10,
    // 26 TU needs the vapor cooler; the cooler's own 18 W pushes the draw
    // past the free 120 W, so a feeder unit comes with it.
    parts: [
      { code: 'VC5', name: 'VC-5 Arc Core', price: 5 },
      { code: 'CX2', name: 'CX-2 Vapor Cooler', price: 2 },
      { code: 'PS3', name: 'PS-3 Feeder Unit', price: 3 },
    ],
  },
  {
    id: 'vc10',
    hash: 20,
    parts: [
      { code: 'VC10', name: 'VC-10 Plasma Core', price: 10 },
      { code: 'CX6', name: 'CX-6 Cryo Loop', price: 6 },
      { code: 'PS3', name: 'PS-3 Feeder Unit', price: 3 },
    ],
  },
  {
    id: 'vc50',
    hash: 90,
    parts: [
      { code: 'VC50', name: 'VC-50 Fusion Core', price: 50 },
      { code: 'CX20', name: 'CX-20 Immersion Bath', price: 20 },
      { code: 'PS12', name: 'PS-12 Substation', price: 12 },
    ],
  },
];

function getMultiplier(invites: number): { level: number; mult: number } {
  if (invites >= 31) return { level: 6, mult: 8 };
  if (invites >= 21) return { level: 5, mult: 6 };
  if (invites >= 11) return { level: 4, mult: 5 };
  if (invites >= 6) return { level: 3, mult: 4 };
  if (invites >= 1) return { level: 2, mult: 3 };
  return { level: 1, mult: 1 };
}

const BASE_RATE = 0.9;

export function MiningCalculator({ locale }: { locale: string }) {
  const t = useTranslations('landing.calculator');

  const [build, setBuild] = useState<Build>(BUILDS[3]);
  const [inviteCount, setInviteCount] = useState<number>(12);

  const tier = getMultiplier(inviteCount);
  const buildCost = build.parts.reduce((n, p) => n + p.price, 0);
  // Every option here is balanced by construction, so stability is 100% and
  // the two efficiency factors are 1. That is the point being made.
  const stableRate = BASE_RATE + build.hash;
  const effectiveRate = +(stableRate * tier.mult).toFixed(1);
  const dailyPoints = +(effectiveRate * 24).toFixed(1);
  const monthlyPoints = +(dailyPoints * 30).toFixed(0);
  const monthlyTokens = +(monthlyPoints / 3).toFixed(0);

  const registerLink = `/${locale}/login?mode=register`;

  return (
    <div className="v-panel v-hud relative overflow-hidden rounded-3xl p-5 sm:p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-charge/10 blur-3xl" />

      <div className="relative grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Controls */}
        <div className="space-y-6 lg:col-span-7">
          <div>
            <span className="v-label">{t('selectBuild')}</span>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {BUILDS.map((b) => {
                const isSelected = build.id === b.id;
                const cost = b.parts.reduce((n, p) => n + p.price, 0);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBuild(b)}
                    aria-pressed={isSelected}
                    className={`rounded-2xl border p-3 text-center transition-all duration-200 ${
                      isSelected
                        ? 'scale-[1.03] border-charge/60 bg-charge/10 shadow-charge'
                        : 'border-line/15 bg-bg/40 hover:border-line/40 hover:bg-surface-2/60'
                    }`}
                  >
                    <div className="text-xs font-bold text-ink">{cost === 0 ? t('freeBase') : `$${cost}`}</div>
                    <div className={`v-num mt-1 text-sm font-extrabold ${isSelected ? 'text-charge' : 'text-ink-3'}`}>
                      {(BASE_RATE + b.hash).toFixed(1)} /h
                    </div>
                    {b.parts.length > 1 && (
                      <div className="mt-0.5 font-mono text-[10px] text-ink-3">
                        {b.parts.length} {t('parts')}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* What the build actually contains — the honest bit. */}
          <div className="rounded-2xl border border-brand/30 bg-brand/[0.07] p-4">
            <p className="v-eyebrow v-eyebrow--brand">{t('buildContents')}</p>
            {build.parts.length === 0 ? (
              <p className="mt-2 text-xs text-ink-2">
                {t('freeBaseNote', { cooling: CHASSIS_NOTE.cooling, watts: CHASSIS_NOTE.watts })}
              </p>
            ) : (
              <>
                <ul className="mt-2 space-y-1">
                  {build.parts.map((p) => (
                    <li key={p.code} className="flex items-center justify-between gap-3 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-ink-2">
                        <Icon
                          name={p.code.startsWith('VC') ? 'chip' : p.code.startsWith('CX') ? 'snow' : 'plug'}
                          size={12}
                          className="text-brand-hi"
                        />
                        {p.name}
                      </span>
                      <span className="v-num font-bold text-ink-3">${p.price}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-line/20 pt-2 text-xs">
                  <span className="font-bold text-ink">{t('buildTotal')}</span>
                  <span className="v-num font-extrabold text-charge">
                    ${buildCost} · {t('stability100')}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Referral slider */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="v-label mb-0">{t('selectInvites')}</span>
              <span className="v-chip v-chip--brand v-num">
                {inviteCount} · L{tier.level} · ×{tier.mult}
              </span>
            </div>
            <div className="mt-4">
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={inviteCount}
                onChange={(e) => setInviteCount(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line/20 accent-[rgb(var(--c-charge))]"
                aria-label={t('selectInvites')}
              />
              <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-3">
                <span>0 ×1</span>
                <span>5 ×3</span>
                <span>10 ×4</span>
                <span>20 ×5</span>
                <span>30 ×6</span>
                <span>31+ ×8</span>
              </div>
            </div>
          </div>

          <div className="v-inset p-4 text-xs text-ink-2">
            <span className="font-bold text-brand-hi">{t('engineLabel')}</span> {stableRate.toFixed(1)} VOLTS/h × 100%{' '}
            {t('stabilityWord')} × ×{tier.mult} ={' '}
            <span className="v-num font-extrabold text-charge">{effectiveRate} VOLTS/h</span>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-5">
          <div className="v-panel v-panel--charge v-scanlines relative overflow-hidden rounded-3xl p-6 sm:p-7">
            <div className="v-eyebrow v-eyebrow--charge">{t('estimatedYield')}</div>

            <div className="mt-5 space-y-4">
              <Row label={t('hourlyRate')}>
                <AnimatedNumber value={effectiveRate} decimals={1} className="text-lg font-extrabold text-charge" suffix=" VOLTS/h" />
              </Row>
              <Row label={t('dailyYield')}>
                <AnimatedNumber value={dailyPoints} decimals={1} className="text-lg font-extrabold text-ink" suffix=" VOLTS" />
              </Row>
              <Row label={t('monthlyYield')}>
                <AnimatedNumber value={monthlyPoints} decimals={0} className="text-xl font-extrabold text-brand-hi" suffix=" VOLTS" />
              </Row>

              <div className="rounded-2xl border border-brand/35 bg-brand/[0.1] p-4 text-center">
                <div className="v-eyebrow v-eyebrow--brand">{t('onChainPayout')}</div>
                <div className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
                  ~<AnimatedNumber value={monthlyTokens} decimals={0} /> $VLTR
                </div>
                <div className="mt-1 text-[11px] text-ink-3">{t('payoutNote')}</div>
              </div>
            </div>

            <Link href={registerLink} className="v-btn v-btn--charge mt-6 w-full">
              {t('cta')}
              <Icon name="arrow-up-right" size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/15 pb-3">
      <span className="text-sm text-ink-3">{label}</span>
      <span>{children}</span>
    </div>
  );
}
